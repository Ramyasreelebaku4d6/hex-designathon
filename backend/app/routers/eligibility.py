from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models import Eligibility, Registration, User, Drive
from app.schemas import EligibilityResponse, ApprovalRequest
from app.auth import get_current_user, require_role
from app.services.eligibility_engine import evaluate_eligibility
from app.services.email_service import (
    send_approval_request_email,
    send_email
)
from app.core.audit_logger import write_audit_log

router = APIRouter()

@router.get("/", )
def get_all_eligibility(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator", "approver"))
):
    records = db.query(Eligibility).all()
    result = []
    for e in records:
        reg = db.query(Registration).filter(
            Registration.id == e.registration_id
        ).first()
        user = db.query(User).filter(
            User.id == reg.user_id
        ).first() if reg else None
        result.append({
            "id": e.id,
            "registration_id": e.registration_id,
            "decision": e.decision,
            "ai_score": e.ai_score,
            "ai_reasons": e.ai_reasons,
            "decision_date": e.decision_date,
            "candidate_name": user.name if user else "Unknown",
            "exam_track": reg.exam_track if reg else "Unknown",
        })
    return result

@router.post("/evaluate/{reg_id}", response_model=EligibilityResponse)
async def evaluate(
    reg_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    reg = db.query(Registration).filter(
        Registration.id == reg_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    # ── Run AI eligibility engine ────────────────────────────────────
    result = await evaluate_eligibility(reg, db)

    # ── Save eligibility record ──────────────────────────────────────
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

    # ── Update registration status ───────────────────────────────────
    reg.status = result["decision"]
    db.commit()

    # ── If pending approval → email ALL approvers ───────────────────
    if result["decision"] == "pending_approval":
        approvers = db.query(User).filter(
            User.role.in_(["approver", "admin"])
        ).all()

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
        after={
            "decision": result["decision"],
            "ai_score": result["ai_score"]
        }
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
    eligibility = db.query(Eligibility).filter(
        Eligibility.id == eligibility_id
    ).first()
    if not eligibility:
        raise HTTPException(
            status_code=404,
            detail="Eligibility record not found"
        )

    before = {"decision": eligibility.decision}
    eligibility.decision = request.decision
    eligibility.approver_id = current_user.id
    eligibility.decision_date = datetime.utcnow()
    db.commit()

    # ── Update registration status ───────────────────────────────────
    reg = db.query(Registration).filter(
        Registration.id == eligibility.registration_id
    ).first()
    if reg:
        reg.status = request.decision
        db.commit()

        # ── Notify candidate of decision ─────────────────────────────
        user = db.query(User).filter(User.id == reg.user_id).first()
        drive = db.query(Drive).filter(Drive.id == reg.drive_id).first()
        if user:
            if request.decision == "eligible":
                subject = "Great news — You are eligible!"
                body = f"""
                <html><body>
                <h2>Hi {user.name},</h2>
                <p>Your eligibility for <strong>
                {drive.name if drive else 'the certification drive'}
                </strong> has been <strong style="color:green;">approved</strong>.</p>
                <p>You will receive further instructions about your assessment schedule.</p>
                <br/><p>Regards,<br/>Maverick Certification Hub</p>
                </body></html>
                """
            else:
                subject = "Eligibility Update"
                body = f"""
                <html><body>
                <h2>Hi {user.name},</h2>
                <p>After review, you are currently <strong style="color:red;">
                not eligible</strong> for 
                <strong>{drive.name if drive else 'this drive'}</strong>.</p>
                <p>Reason: {request.reason or 'Policy criteria not met.'}</p>
                <p>Please contact your coordinator for more information.</p>
                <br/><p>Regards,<br/>Maverick Certification Hub</p>
                </body></html>
                """
            background_tasks.add_task(
                send_email, user.email, subject, body
            )

    write_audit_log(
        db=db,
        entity_type="Eligibility",
        entity_id=eligibility_id,
        action="approved" if request.decision == "eligible" else "rejected",
        actor_id=current_user.id,
        before=before,
        after={"decision": request.decision}
    )
    return {
        "message": f"Eligibility updated to {request.decision}",
        "notified": True
    }