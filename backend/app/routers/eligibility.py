from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models import Eligibility, Registration, User, Drive, DriveCertification, Certification
from app.schemas import EligibilityResponse, ApprovalRequest
from app.auth import get_current_user, require_role
from app.services.eligibility_engine import evaluate_eligibility
from app.services.email_service import send_approval_request_email, send_email
from app.core.audit_logger import write_audit_log

router = APIRouter()


@router.get("/")
def get_eligibility_grouped(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "approver"))
):
    # ── 1. Fetch all registrations with their eligibility decision in 3 queries ──
    def regs_by_decision(decision):
        return (
            db.query(Registration)
            .join(Eligibility, Eligibility.registration_id == Registration.id)
            .filter(Eligibility.decision == decision)
            .order_by(Registration.created_at.desc())
            .all()
        )

    eligible_regs  = regs_by_decision("eligible")
    ineligible_regs = regs_by_decision("ineligible")
    pending_regs   = regs_by_decision("pending_approval")
    all_regs = eligible_regs + ineligible_regs + pending_regs

    if not all_regs:
        return {"eligible": [], "ineligible": [], "pending_approval": []}

    reg_ids   = [r.id for r in all_regs]
    user_ids  = list({r.user_id for r in all_regs})
    drive_ids = list({r.drive_id for r in all_regs})

    # ── 2. Bulk-load users, drives, eligibilities ──────────────────────────────
    users_map  = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    drives_map = {d.id: d for d in db.query(Drive).filter(Drive.id.in_(drive_ids)).all()}
    eligs_map  = {
        e.registration_id: e
        for e in db.query(Eligibility).filter(Eligibility.registration_id.in_(reg_ids)).all()
    }

    # ── 3. Bulk-load drive certifications for pending registrations only ───────
    pending_drive_ids = list({r.drive_id for r in pending_regs})
    drive_certs_map: dict = {did: [] for did in pending_drive_ids}
    if pending_drive_ids:
        rows = (
            db.query(DriveCertification, Certification)
            .join(Certification, Certification.id == DriveCertification.cert_id)
            .filter(DriveCertification.drive_id.in_(pending_drive_ids))
            .all()
        )
        for dc, cert in rows:
            drive_certs_map[dc.drive_id].append({"cert_id": cert.id, "cert_name": cert.name})

    # ── 4. Assemble results ────────────────────────────────────────────────────
    def build_item(reg, include_drive_certs=False):
        user  = users_map.get(reg.user_id)
        drive = drives_map.get(reg.drive_id)
        elig  = eligs_map.get(reg.id)
        item = {
            "registration_id": reg.id,
            "eligibility_id": elig.id if elig else None,
            "candidate_name": user.name if user else "Unknown",
            "candidate_email": user.email if user else "",
            "drive_name": drive.name if drive else "Unknown",
            "drive_id": reg.drive_id,
            "exam_track": reg.exam_track,
            "custom_cert_name": reg.custom_cert_name,
            "is_custom_cert": reg.is_custom_cert,
            "ai_score": elig.ai_score if elig else None,
            "ai_reasons": elig.ai_reasons if elig else None,
            "decision_date": elig.decision_date if elig else reg.created_at,
            "created_at": reg.created_at,
        }
        if include_drive_certs:
            item["drive_certifications"] = drive_certs_map.get(reg.drive_id, [])
        return item

    return {
        "eligible":        [build_item(r) for r in eligible_regs],
        "ineligible":      [build_item(r) for r in ineligible_regs],
        "pending_approval": [build_item(r, include_drive_certs=True) for r in pending_regs],
    }


@router.post("/evaluate/{reg_id}", response_model=EligibilityResponse)
async def evaluate(
    reg_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator", "approver"))
):
    reg = db.query(Registration).filter(Registration.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    result = await evaluate_eligibility(reg, db)

    eligibility = db.query(Eligibility).filter(
        Eligibility.registration_id == reg_id
    ).first()
    if not eligibility:
        eligibility = Eligibility(registration_id=reg_id)
        db.add(eligibility)

    eligibility.decision = result["decision"]
    eligibility.ai_score = result["ai_score"]
    eligibility.ai_reasons = str(result["reasons"])
    eligibility.criteria_json = str(result["criteria"])
    eligibility.decision_date = datetime.utcnow()
    db.commit()
    db.refresh(eligibility)

    reg.status = result["decision"]
    db.commit()

    if result["decision"] == "pending_approval":
        approvers = db.query(User).filter(User.role.in_(["approver", "admin"])).all()
        user = db.query(User).filter(User.id == reg.user_id).first()
        drive = db.query(Drive).filter(Drive.id == reg.drive_id).first()
        for approver in approvers:
            background_tasks.add_task(
                send_approval_request_email,
                to_email=approver.email,
                approver_name=approver.name,
                candidate_name=user.name if user else "Candidate",
                exam_track=reg.exam_track or "General",
                drive_name=drive.name if drive else "Drive",
                registration_id=reg_id,
                ai_score=result["ai_score"],
                ai_reasons=str(result["reasons"]),
                approval_url="http://localhost:5173/eligibility"
            )

    write_audit_log(
        db=db,
        entity_type="Eligibility",
        entity_id=eligibility.id,
        action="evaluated",
        actor_id=current_user.id,
        after={"decision": result["decision"], "ai_score": result["ai_score"]}
    )
    return eligibility


@router.put("/{eligibility_id}/approve")
def approve_eligibility(
    eligibility_id: str,
    request: ApprovalRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "approver"))
):
    eligibility = db.query(Eligibility).filter(Eligibility.id == eligibility_id).first()
    if not eligibility:
        raise HTTPException(status_code=404, detail="Eligibility record not found")

    before = {"decision": eligibility.decision}
    eligibility.decision = request.decision
    eligibility.approver_id = current_user.id
    eligibility.decision_date = datetime.utcnow()
    db.commit()

    reg = db.query(Registration).filter(
        Registration.id == eligibility.registration_id
    ).first()
    if reg:
        # If approver linked a cert (manual approval of Others cert)
        if request.cert_id:
            cert = db.query(Certification).filter(
                Certification.id == request.cert_id
            ).first()
            if cert:
                reg.cert_id = request.cert_id
                reg.exam_track = cert.name
                reg.is_custom_cert = False

        reg.status = request.decision
        db.commit()

        user = db.query(User).filter(User.id == reg.user_id).first()
        drive = db.query(Drive).filter(Drive.id == reg.drive_id).first()
        if user:
            if request.decision == "eligible":
                subject = "Great news — You are eligible!"
                body = f"""<html><body>
<h2>Hi {user.name},</h2>
<p>Your eligibility for <strong>{drive.name if drive else 'the certification drive'}</strong>
has been <strong style="color:green;">approved</strong>.</p>
<p>Please log in to complete your course and proceed to the next step.</p>
<br/><p>Regards,<br/>Maverick Certification Hub</p>
</body></html>"""
            else:
                subject = "Eligibility Update"
                body = f"""<html><body>
<h2>Hi {user.name},</h2>
<p>After review, you are currently <strong style="color:red;">not eligible</strong>
for <strong>{drive.name if drive else 'this drive'}</strong>.</p>
<p>Reason: {request.reason or 'Policy criteria not met.'}</p>
<br/><p>Regards,<br/>Maverick Certification Hub</p>
</body></html>"""
            background_tasks.add_task(send_email, user.email, subject, body)

    write_audit_log(
        db=db,
        entity_type="Eligibility",
        entity_id=eligibility_id,
        action="approved" if request.decision == "eligible" else "rejected",
        actor_id=current_user.id,
        before=before,
        after={"decision": request.decision, "cert_mapped": request.cert_id}
    )
    return {"message": f"Eligibility updated to {request.decision}", "notified": True}
