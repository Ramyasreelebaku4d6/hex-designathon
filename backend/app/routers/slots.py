from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.database import get_db
from app.models import ExamSlot, Drive, Registration
from app.schemas import SlotResponse
from app.auth import get_current_user, require_role
import uuid

router = APIRouter()

@router.post("/drives/{drive_id}/generate")
def generate_slots(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    if not drive.start_date or not drive.end_date:
        raise HTTPException(
            status_code=400,
            detail="Drive must have start and end dates to generate slots"
        )

    # Delete existing slots for this drive
    db.query(ExamSlot).filter(ExamSlot.drive_id == drive_id).delete()
    db.commit()

    # Generate slots: each day from start to end
    # 10 slots per day starting at 9 AM, 1 hour apart
    slots_created = 0
    current_date = drive.start_date.date()
    end_date = drive.end_date.date()

    while current_date <= end_date:
        for hour in range(9, 19):  # 9 AM to 6 PM = 10 slots
            slot_dt = datetime(
                current_date.year,
                current_date.month,
                current_date.day,
                hour, 0, 0
            )
            slot = ExamSlot(
                id=str(uuid.uuid4()),
                drive_id=drive_id,
                slot_datetime=slot_dt,
                is_booked=False
            )
            db.add(slot)
            slots_created += 1
        current_date += timedelta(days=1)

    db.commit()
    return {
        "message": f"{slots_created} slots generated",
        "slots_created": slots_created,
        "from": str(drive.start_date.date()),
        "to": str(drive.end_date.date())
    }

@router.get("/drives/{drive_id}", response_model=List[SlotResponse])
def get_drive_slots(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    slots = db.query(ExamSlot).filter(
        ExamSlot.drive_id == drive_id
    ).order_by(ExamSlot.slot_datetime).all()
    return slots

@router.post("/{slot_id}/book")
def book_slot(
    slot_id: str,
    registration_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    slot = db.query(ExamSlot).filter(ExamSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Slot already booked")

    slot.is_booked = True
    slot.booked_by_reg_id = registration_id
    db.commit()
    return {"message": "Slot booked successfully"}