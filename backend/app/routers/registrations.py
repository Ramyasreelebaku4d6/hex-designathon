from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    Registration, Drive, User, Eligibility,
    ExamSlot, Certification, DriveCertification
)
from app.schemas import RegistrationCreate, RegistrationResponse
from app.auth import get_current_user
from app.core.audit_logger import write_audit_log
from app.services.email_service import (
    send_ack_email,
    send_eligibility_email
)

router = APIRouter()

@router.post("/", response_model=RegistrationResponse)
async def create_registration(
    request: RegistrationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # ── Check drive ──────────────────────────────────────────────────
    drive = db.query(Drive).filter(Drive.id == request.drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    if drive.status != "active":
        raise HTTPException(status_code=400, detail="Drive is not active")

    # ── Prevent duplicate ────────────────────────────────────────────
    existing = db.query(Registration).filter(
        Registration.drive_id == request.drive_id,
        Registration.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Already applied for this drive"
        )

    # ── Auto-calculate prior attempts ────────────────────────────────
    from app.models import ExamSession
    prior_attempts = 0
    cert_name = request.custom_cert_name or request.exam_track

    if request.cert_id:
        cert = db.query(Certification).filter(
            Certification.id == request.cert_id
        ).first()
        if cert:
            cert_name = cert.name

    all_user_regs = db.query(Registration).filter(
        Registration.user_id == current_user.id,
        Registration.drive_id != request.drive_id
    ).all()

    for r in all_user_regs:
        is_same = (
            (request.cert_id and r.cert_id == request.cert_id) or
            (cert_name and r.exam_track and
             cert_name.lower() == r.exam_track.lower())
        )
        if is_same:
            sessions = db.query(ExamSession).filter(
                ExamSession.registration_id == r.id,
                ExamSession.status.in_(["started", "submitted"])
            ).count()
            prior_attempts += sessions

    # ── Is custom cert? ──────────────────────────────────────────────
    is_custom = bool(request.custom_cert_name and not request.cert_id)

    # ── Create registration ──────────────────────────────────────────
    registration = Registration(
        drive_id=request.drive_id,
        user_id=current_user.id,
        exam_track=request.exam_track or request.custom_cert_name,
        cert_id=request.cert_id,
        custom_cert_name=request.custom_cert_name,
        is_custom_cert=is_custom,
        slot_id=request.slot_id,
        slot_datetime=request.slot_datetime,
        prior_attempts=prior_attempts,
        status="submitted"
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    # ── Book slot ────────────────────────────────────────────────────
    if request.slot_id:
        slot = db.query(ExamSlot).filter(
            ExamSlot.id == request.slot_id
        ).first()
        if slot and not slot.is_booked:
            slot.is_booked = True
            slot.booked_by_reg_id = registration.id
            db.commit()

    # ── Audit log ────────────────────────────────────────────────────
    write_audit_log(
        db=db,
        entity_type="Registration",
        entity_id=registration.id,
        action="created",
        actor_id=current_user.id,
        after={
            "drive_id": request.drive_id,
            "cert": cert_name,
            "is_custom": is_custom,
            "prior_attempts": prior_attempts,
            "status": "submitted"
        }
    )

    # ── Run all background tasks ─────────────────────────────────────
    background_tasks.add_task(
        _process_registration_background,
        registration_id=registration.id,
        drive_id=request.drive_id,
        user_id=current_user.id,
        cert_name=cert_name or "",
        drive_name=drive.name,
        is_custom=is_custom,
        prior_attempts=prior_attempts,
        slot_datetime=request.slot_datetime
    )

    return registration


async def _process_registration_background(
    registration_id: str,
    drive_id: str,
    user_id: str,
    cert_name: str,
    drive_name: str,
    is_custom: bool,
    prior_attempts: int,
    slot_datetime=None
):
    """
    Runs in background after registration:
    1. Send ACK email (AI-generated)
    2. Auto-evaluate eligibility
    3. Auto-approve or send to approver
    4. Send eligibility result email (AI-generated)
    5. Auto-allocate voucher if eligible + not custom cert
    """
    from app.database import SessionLocal
    db = SessionLocal()

    try:
        reg = db.query(Registration).filter(
            Registration.id == registration_id
        ).first()
        user = db.query(User).filter(User.id == user_id).first()
        drive = db.query(Drive).filter(Drive.id == drive_id).first()

        if not reg or not user or not drive:
            return

        # ── Step 1: ACK email ────────────────────────────────────────
        reg.ack_email_sent_at = datetime.utcnow()
        db.commit()

        send_ack_email(
            to_email=user.email,
            name=user.name,
            drive_name=drive_name,
            registration_id=registration_id,
            exam_track=cert_name,
            slot_datetime=slot_datetime
        )

        # ── Step 2: Auto-evaluate eligibility ───────────────────────
        tenure_days = 0
        tenure_ok = False
        if user.tenure_start_date:
            tenure_days = (datetime.utcnow() - user.tenure_start_date).days
            tenure_ok = tenure_days >= 90

        attempts_ok = prior_attempts <= 2

        # ── Step 3: AI scoring ───────────────────────────────────────
        from app.services.openai_service import get_ai_eligibility_score
        ai_result = await get_ai_eligibility_score(
            tenure_days=tenure_days,
            prior_attempts=prior_attempts,
            exam_track=cert_name or "General",
            rules_passed=tenure_ok and attempts_ok
        )

        # ── Step 4: Determine decision ───────────────────────────────
        if not tenure_ok:
            decision = "ineligible"
            reason = f"Tenure is {tenure_days} days — minimum 90 days required"
        elif not attempts_ok:
            decision = "ineligible"
            reason = f"Prior attempts ({prior_attempts}) exceed limit of 2 in last 365 days"
        elif is_custom:
            # Custom cert → pending approval from approver
            decision = "pending_approval"
            reason = "Custom certification requires manual approver review"
        else:
            # Standard cert in drive list → auto-approve
            decision = "eligible"
            reason = "All eligibility criteria met — auto-approved"

        # ── Step 5: Save eligibility ─────────────────────────────────
        import json
        eligibility = Eligibility(
            registration_id=registration_id,
            criteria_json=json.dumps({
                "tenure_days": tenure_days,
                "tenure_ok": tenure_ok,
                "prior_attempts": prior_attempts,
                "attempts_ok": attempts_ok,
                "is_custom_cert": is_custom,
            }),
            decision=decision,
            ai_score=ai_result["score"],
            ai_reasons=str(ai_result["reasons"]),
            decision_date=datetime.utcnow()
        )
        db.add(eligibility)

        # Update registration status
        reg.status = decision
        db.commit()

        print(
            f"[AUTO-ELIG] {user.email} → {decision} "
            f"(tenure={tenure_days}d, attempts={prior_attempts})"
        )

        # ── Step 6: Send eligibility email ───────────────────────────
        if decision != "pending_approval":
            send_eligibility_email(
                to_email=user.email,
                name=user.name,
                drive_name=drive_name,
                exam_track=cert_name,
                decision=decision,
                ai_score=ai_result["score"],
                ai_reasons=ai_result["reasons"],
                reason=reason
            )

        # ── Step 7: Notify approvers if pending ──────────────────────
        if decision == "pending_approval":
            approvers = db.query(User).filter(
                User.role.in_(["approver", "admin"])
            ).all()
            from app.services.email_service import send_approval_request_email
            for approver in approvers:
                send_approval_request_email(
                    to_email=approver.email,
                    approver_name=approver.name,
                    candidate_name=user.name,
                    exam_track=cert_name,
                    drive_name=drive_name,
                    registration_id=registration_id,
                    ai_score=ai_result["score"],
                    ai_reasons=str(ai_result["reasons"]),
                    approval_url="http://localhost:5173/eligibility"
                )

        # ── Step 8: Auto-allocate voucher if eligible ────────────────
        if decision == "eligible":
            from app.services.voucher_service import auto_allocate_voucher
            await auto_allocate_voucher(
                registration_id=registration_id,
                drive_id=drive_id,
                user_id=user_id,
                db=db
            )

    except Exception as e:
        print(f"[AUTO-ELIG] Background task failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


@router.get("/", response_model=list[RegistrationResponse])
def get_registrations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.role == "candidate":
        return db.query(Registration).filter(
            Registration.user_id == current_user.id
        ).all()
    return db.query(Registration).all()


@router.get("/check/{drive_id}")
def check_already_applied(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    existing = db.query(Registration).filter(
        Registration.drive_id == drive_id,
        Registration.user_id == current_user.id
    ).first()
    return {
        "already_applied": existing is not None,
        "registration_id": existing.id if existing else None,
        "status": existing.status if existing else None
    }


@router.get("/{reg_id}", response_model=RegistrationResponse)
def get_registration(
    reg_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    reg = db.query(Registration).filter(
        Registration.id == reg_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    return reg


@router.get("/{reg_id}/status")
def get_registration_status(
    reg_id: str,
    db: Session = Depends(get_db)
):
    reg = db.query(Registration).filter(
        Registration.id == reg_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    return {
        "registration_id": reg.id,
        "status": reg.status,
        "exam_track": reg.exam_track,
        "slot_datetime": reg.slot_datetime,
        "created_at": reg.created_at
    }