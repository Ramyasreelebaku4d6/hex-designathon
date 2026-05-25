from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import Registration, Drive, User
from app.schemas import RegistrationCreate, RegistrationResponse
from app.auth import get_current_user
from app.core.audit_logger import write_audit_log
from app.services.email_service import send_ack_email

router = APIRouter()

@router.post("/", response_model=RegistrationResponse)
def create_registration(
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
        raise HTTPException(
            status_code=400,
            detail="Drive is not active for registration"
        )
    # Check for duplicate registration
    existing = db.query(Registration).filter(
        Registration.drive_id == request.drive_id,
        Registration.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Already registered for this drive"
        )
    registration = Registration(
        drive_id=request.drive_id,
        user_id=current_user.id,
        exam_track=request.exam_track,
        slot_datetime=request.slot_datetime,
        prior_attempts=request.prior_attempts or 0,
        status="submitted"
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    # Send ACK email in background (meets ≤5 min SLA)
    background_tasks.add_task(
        send_ack_email,
        to_email=current_user.email,
        name=current_user.name,
        drive_name=drive.name,
        registration_id=registration.id
    )

    # Update ack sent time
    registration.ack_email_sent_at = datetime.utcnow()
    db.commit()

    write_audit_log(
        db=db,
        entity_type="Registration",
        entity_id=registration.id,
        action="created",
        actor_id=current_user.id,
        after={"drive_id": request.drive_id, "status": "submitted"}
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