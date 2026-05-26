from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import Registration, Drive, User, ExamSlot, Certification
from app.schemas import RegistrationCreate, RegistrationResponse
from app.auth import get_current_user
from app.core.audit_logger import write_audit_log
from app.services.email_service import send_ack_email

router = APIRouter()

@router.post("/", response_model=RegistrationResponse)
async def create_registration(
    request: RegistrationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Check drive exists and is active
    drive = db.query(Drive).filter(Drive.id == request.drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    if drive.status != "active":
        raise HTTPException(status_code=400, detail="Drive is not active")

    # ── Prevent duplicate registration for same drive ────────────────
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
    # Count how many times this user registered for the
    # same certification in ANY previous drive
    prior_attempts = 0
    if request.cert_id or request.exam_track or request.custom_cert_name:
        cert_name = request.custom_cert_name or request.exam_track
        if request.cert_id:
            from app.models import Certification
            cert = db.query(Certification).filter(
                Certification.id == request.cert_id
            ).first()
            cert_name = cert.name if cert else cert_name

        prior_regs = db.query(Registration).filter(
            Registration.user_id == current_user.id,
            Registration.drive_id != request.drive_id
        ).all()

        for pr in prior_regs:
            if request.cert_id and pr.cert_id == request.cert_id:
                prior_attempts += 1
            elif cert_name and pr.exam_track and \
                 cert_name.lower() in pr.exam_track.lower():
                prior_attempts += 1

    # ── Handle custom cert — store for approver review ──────────────
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
        prior_attempts=prior_attempts,  # auto-calculated
        status="submitted"
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    # ── Book the slot if provided ────────────────────────────────────
    if request.slot_id:
        slot = db.query(ExamSlot).filter(
            ExamSlot.id == request.slot_id
        ).first()
        if slot and not slot.is_booked:
            slot.is_booked = True
            slot.booked_by_reg_id = registration.id
            db.commit()

    # ── Send ACK email ───────────────────────────────────────────────
    background_tasks.add_task(
        send_ack_email,
        to_email=current_user.email,
        name=current_user.name,
        drive_name=drive.name,
        registration_id=registration.id
    )
    registration.ack_email_sent_at = datetime.utcnow()
    db.commit()

    write_audit_log(
        db=db,
        entity_type="Registration",
        entity_id=registration.id,
        action="created",
        actor_id=current_user.id,
        after={
            "drive_id": request.drive_id,
            "cert": request.exam_track or request.custom_cert_name,
            "is_custom": is_custom,
            "prior_attempts": prior_attempts,
            "status": "submitted"
        }
    )
    return registration

@router.get("/", response_model=List[RegistrationResponse])
def get_registrations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Candidates see only their own registrations
    if current_user.role == "candidate":
        return db.query(Registration).filter(
            Registration.user_id == current_user.id
        ).all()
    # Admin/Coordinator see all
    return db.query(Registration).all()

@router.get("/{reg_id}", response_model=RegistrationResponse)
def get_registration(
    reg_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    reg = db.query(Registration).filter(Registration.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    return reg

@router.get("/{reg_id}/status")
def get_registration_status(
    reg_id: str,
    db: Session = Depends(get_db)
):
    reg = db.query(Registration).filter(Registration.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    return {
        "registration_id": reg.id,
        "status": reg.status,
        "exam_track": reg.exam_track,
        "slot_datetime": reg.slot_datetime,
        "created_at": reg.created_at
    }

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