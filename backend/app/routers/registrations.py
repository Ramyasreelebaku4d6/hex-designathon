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

    # ── Resolve cert name ────────────────────────────────────────────
    from app.models import Voucher
    from datetime import timedelta
    prior_attempts = 0
    cert_name = request.custom_cert_name or request.exam_track

    if request.cert_id:
        cert = db.query(Certification).filter(
            Certification.id == request.cert_id
        ).first()
        if cert:
            cert_name = cert.name

    # ── Auto-calculate prior attempts (redeemed vouchers for same cert) ──
    cutoff = datetime.utcnow() - timedelta(days=365)
    all_user_regs = db.query(Registration).filter(
        Registration.user_id == current_user.id,
        Registration.drive_id != request.drive_id
    ).all()

    same_cert_reg_ids = [
        r.id for r in all_user_regs
        if (
            (request.cert_id and r.cert_id == request.cert_id) or
            (cert_name and r.exam_track and
             cert_name.lower() == r.exam_track.lower())
        )
    ]

    if same_cert_reg_ids:
        prior_attempts = db.query(Voucher).filter(
            Voucher.registration_id.in_(same_cert_reg_ids),
            Voucher.status == "redeemed",
            Voucher.redeemed_at >= cutoff,
        ).count()

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
        status="registered"
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

        import asyncio
        await asyncio.to_thread(
            send_ack_email,
            to_email=user.email,
            name=user.name,
            drive_name=drive_name,
            registration_id=registration_id,
            exam_track=cert_name,
            slot_datetime=slot_datetime,
        )

        # ── Step 2: Evaluate eligibility via engine ──────────────────
        from app.services.eligibility_engine import evaluate_eligibility
        result = await evaluate_eligibility(reg, db)
        decision = result["decision"]

        # ── Step 3: Save eligibility record ─────────────────────────
        import json
        eligibility = Eligibility(
            registration_id=registration_id,
            criteria_json=json.dumps(result.get("criteria", {})),
            decision=decision,
            ai_score=result["ai_score"],
            ai_reasons=str(result["reasons"]),
            decision_date=datetime.utcnow()
        )
        db.add(eligibility)
        reg.status = decision
        db.commit()

        print(
            f"[AUTO-ELIG] {user.email} → {decision} "
            f"(ai_score={result['ai_score']})"
        )

        # ── Step 6: Send eligibility email ───────────────────────────
        if decision != "pending_approval":
            await asyncio.to_thread(
                send_eligibility_email,
                to_email=user.email,
                name=user.name,
                drive_name=drive_name,
                exam_track=cert_name,
                decision=decision,
                ai_score=result["ai_score"],
                ai_reasons=result["reasons"],
                reason=result["reasons"][0] if result["reasons"] else "",
            )

        # ── Step 7: Notify approvers if pending ──────────────────────
        if decision == "pending_approval":
            approvers = db.query(User).filter(
                User.role.in_(["approver", "admin"])
            ).all()
            from app.services.email_service import send_approval_request_email
            import asyncio as _asyncio
            for approver in approvers:
                await _asyncio.to_thread(
                    send_approval_request_email,
                    to_email=approver.email,
                    approver_name=approver.name,
                    candidate_name=user.name,
                    exam_track=cert_name,
                    drive_name=drive_name,
                    registration_id=registration_id,
                    ai_score=result["ai_score"],
                    ai_reasons=str(result["reasons"]),
                    approval_url="http://localhost:5173/eligibility",
                )

    except Exception as e:
        print(f"[AUTO-ELIG] Background task failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


@router.get("/by-drive")
def get_registrations_by_drive(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.role not in ("admin", "approver", "coordinator"):
        raise HTTPException(status_code=403, detail="Not authorized")

    drives = db.query(Drive).order_by(Drive.created_at.desc()).all()
    result = []
    for drive in drives:
        regs = (
            db.query(Registration)
            .filter(Registration.drive_id == drive.id)
            .order_by(Registration.created_at.desc())
            .all()
        )
        reg_list = []
        for reg in regs:
            user = db.query(User).filter(User.id == reg.user_id).first()
            reg_list.append({
                "id": reg.id,
                "user_id": reg.user_id,
                "user_name": user.name if user else "Unknown",
                "user_email": user.email if user else "",
                "exam_track": reg.exam_track,
                "is_custom_cert": reg.is_custom_cert,
                "status": reg.status,
                "created_at": reg.created_at,
            })
        result.append({
            "drive_id": drive.id,
            "drive_name": drive.name,
            "drive_status": drive.status,
            "start_date": drive.start_date,
            "end_date": drive.end_date,
            "registration_count": len(reg_list),
            "registrations": reg_list,
        })
    return result


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