from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Drive
from app.schemas import DriveCreate, DriveResponse
from app.auth import get_current_user, require_role
from app.core.audit_logger import write_audit_log

router = APIRouter()

@router.get("/", response_model=List[DriveResponse])
def get_drives(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Drive).all()

@router.get("/{drive_id}", response_model=DriveResponse)
def get_drive(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    return drive

@router.post("/", response_model=DriveResponse)
def create_drive(
    request: DriveCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    drive = Drive(
        name=request.name,
        sponsor=request.sponsor,
        budget=request.budget,
        start_date=request.start_date,
        end_date=request.end_date,
        policy_url=request.policy_url,
        pass_threshold=request.pass_threshold or 70.0, 
        status="draft"
    )
    db.add(drive)
    db.commit()
    db.refresh(drive)
    write_audit_log(
        db=db,
        entity_type="Drive",
        entity_id=drive.id,
        action="created",
        actor_id=current_user.id,
        after={"name": drive.name, "status": drive.status}
    )
    return drive

@router.put("/{drive_id}", response_model=DriveResponse)
def update_drive(
    drive_id: str,
    request: DriveCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    before = {"name": drive.name, "status": drive.status}
    drive.name = request.name
    drive.sponsor = request.sponsor
    drive.budget = request.budget
    drive.start_date = request.start_date
    drive.end_date = request.end_date
    drive.policy_url = request.policy_url
    db.commit()
    db.refresh(drive)
    write_audit_log(
        db=db,
        entity_type="Drive",
        entity_id=drive.id,
        action="updated",
        actor_id=current_user.id,
        before=before,
        after={"name": drive.name, "status": drive.status}
    )
    return drive

@router.patch("/{drive_id}/status")
def update_drive_status(
    drive_id: str,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    before_status = drive.status
    drive.status = status
    db.commit()
    write_audit_log(
        db=db,
        entity_type="Drive",
        entity_id=drive.id,
        action="status_changed",
        actor_id=current_user.id,
        before={"status": before_status},
        after={"status": status}
    )
    return {"message": f"Drive status updated to {status}"}