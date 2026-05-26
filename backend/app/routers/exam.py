from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    ExamSession, Registration, Voucher,
    UserCertificate, User, Drive, Certification
)
from app.auth import get_current_user, require_role
from app.core.security import decrypt_voucher_code
from app.core.audit_logger import write_audit_log

import uuid

router = APIRouter()

@router.post("/verify-voucher")
def verify_voucher(
    registration_id: str,
    voucher_code: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Get registration
    reg = db.query(Registration).filter(
        Registration.id == registration_id,
        Registration.user_id == current_user.id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    # Get voucher
    voucher = db.query(Voucher).filter(
        Voucher.registration_id == registration_id
    ).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="No voucher found")

    if voucher.status == "expired":
        raise HTTPException(status_code=400, detail="Voucher already used")

    # Decrypt and compare
    try:
        decrypted = decrypt_voucher_code(voucher.code_encrypted)
    except Exception:
        raise HTTPException(status_code=500, detail="Voucher decryption failed")

    if voucher_code.strip() != decrypted.strip():
        raise HTTPException(status_code=400, detail="Invalid voucher code")

    # Check slot timing
    now = datetime.utcnow()
    slot_time = reg.slot_datetime

    if slot_time and slot_time > now:
        diff = slot_time - now
        total_minutes = int(diff.total_seconds() / 60)
        hours = total_minutes // 60
        minutes = total_minutes % 60
        return {
            "valid": True,
            "can_start": False,
            "slot_time": slot_time,
            "message": f"Exam starts in {hours}h {minutes}m",
            "hours_remaining": hours,
            "minutes_remaining": minutes,
        }

    return {
        "valid": True,
        "can_start": True,
        "slot_time": slot_time,
        "message": "Voucher verified. You can start your exam.",
    }

@router.post("/start")
def start_exam(
    registration_id: str,
    voucher_code: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    reg = db.query(Registration).filter(
        Registration.id == registration_id,
        Registration.user_id == current_user.id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    # Check slot time
    now = datetime.utcnow()
    if reg.slot_datetime and reg.slot_datetime > now:
        raise HTTPException(
            status_code=400,
            detail="Exam slot has not started yet"
        )

    # Verify voucher
    voucher = db.query(Voucher).filter(
        Voucher.registration_id == registration_id
    ).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")

    decrypted = decrypt_voucher_code(voucher.code_encrypted)
    if voucher_code.strip() != decrypted.strip():
        raise HTTPException(status_code=400, detail="Invalid voucher code")

    # Create exam session
    session = ExamSession(
        id=str(uuid.uuid4()),
        registration_id=registration_id,
        voucher_code_entered=voucher_code,
        started_at=now,
        status="started"
    )
    db.add(session)
    db.commit()

    return {
        "session_id": session.id,
        "started_at": now,
        "message": "Exam started"
    }

@router.post("/submit/{session_id}")
def submit_exam(
    session_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    session = db.query(ExamSession).filter(
        ExamSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "submitted":
        raise HTTPException(status_code=400, detail="Already submitted")

    now = datetime.utcnow()
    session.submitted_at = now
    session.status = "submitted"

    # Expire voucher
    voucher = db.query(Voucher).filter(
        Voucher.registration_id == session.registration_id
    ).first()
    if voucher:
        voucher.status = "expired"

    # Update registration status
    reg = db.query(Registration).filter(
        Registration.id == session.registration_id
    ).first()
    if reg:
        reg.status = "exam_submitted"
    db.commit()

    # ── Auto-generate certificate ────────────────────────────────────
    try:
        existing_cert = db.query(UserCertificate).filter(
            UserCertificate.registration_id == session.registration_id
        ).first()

        if not existing_cert and reg:
            cert_name = reg.exam_track or reg.custom_cert_name or "Certification"
            expiry = now + timedelta(days=365)

            cert = UserCertificate(
                id=str(uuid.uuid4()),
                user_id=reg.user_id,
                registration_id=reg.id,
                drive_id=reg.drive_id,
                cert_id=reg.cert_id,
                cert_name=cert_name,
                issued_date=now,
                expiry_date=expiry,
                status="active"
            )
            db.add(cert)
            reg.status = "certified"
            db.commit()
            db.refresh(cert)
            print(f"[CERT] Auto-generated certificate {cert.id} for reg {reg.id}")

    except Exception as e:
        print(f"[CERT] Auto-generation failed: {e}")

    return {
        "message": "Exam submitted and certificate generated",
        "submitted_at": now
    }

@router.post("/generate-certificate")
def generate_certificate(
    registration_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    reg = db.query(Registration).filter(
        Registration.id == registration_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    # Check no duplicate cert
    existing = db.query(UserCertificate).filter(
        UserCertificate.registration_id == registration_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Certificate already generated"
        )

    now = datetime.utcnow()
    expiry = now + timedelta(days=365)

    # Get cert name
    cert_name = reg.exam_track or reg.custom_cert_name or "Certification"

    cert = UserCertificate(
        id=str(uuid.uuid4()),
        user_id=reg.user_id,
        registration_id=registration_id,
        drive_id=reg.drive_id,
        cert_id=reg.cert_id,
        cert_name=cert_name,
        issued_date=now,
        expiry_date=expiry,
        status="active"
    )
    db.add(cert)

    # Update registration
    reg.status = "certified"
    db.commit()
    db.refresh(cert)

    return {
        "certificate_id": cert.id,
        "cert_name": cert_name,
        "issued_date": cert.issued_date,
        "expiry_date": cert.expiry_date,
        "message": "Certificate generated successfully"
    }

@router.get("/certificates/my")
def get_my_certificates(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    now = datetime.utcnow()
    certs = db.query(UserCertificate).filter(
        UserCertificate.user_id == current_user.id
    ).all()

    result = []
    for cert in certs:
        # Auto-update expired status
        if cert.expiry_date < now and cert.status == "active":
            cert.status = "expired"
            db.commit()

        drive = db.query(Drive).filter(Drive.id == cert.drive_id).first()
        result.append({
            "id": cert.id,
            "cert_name": cert.cert_name,
            "drive_name": drive.name if drive else "Unknown",
            "issued_date": cert.issued_date,
            "expiry_date": cert.expiry_date,
            "status": cert.status,
            "days_remaining": max(0, (cert.expiry_date - now).days),
        })
    return result

@router.post("/complete-course")
async def complete_course(
    registration_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    reg = db.query(Registration).filter(
        Registration.id == registration_id,
        Registration.user_id == current_user.id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    if reg.course_completed:
        raise HTTPException(status_code=400, detail="Course already completed")

    # Mark course completed
    reg.course_completed = True
    reg.status = "course_completed"
    db.commit()

    # ── Auto trigger voucher allocation ──────────────────────────────
    from app.services.voucher_service import auto_allocate_voucher
    voucher = await auto_allocate_voucher(
        registration_id=registration_id,
        drive_id=reg.drive_id,
        user_id=reg.user_id,
        db=db
    )

    write_audit_log(
        db=db,
        entity_type="Registration",
        entity_id=registration_id,
        action="course_completed",
        actor_id=current_user.id,
        after={"course_completed": True, "voucher_allocated": voucher is not None}
    )

    return {
        "message": "Course marked as completed",
        "voucher_allocated": voucher is not None,
        "voucher_id": voucher.id if voucher else None
    }