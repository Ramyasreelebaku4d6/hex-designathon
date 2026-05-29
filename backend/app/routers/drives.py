from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models import (
    Drive, User, DriveCertification,
    Certification, Voucher, ExamSlot
)
from app.schemas import DriveCreate, DriveResponse
from app.auth import get_current_user, require_role
from app.core.audit_logger import write_audit_log
from app.core.security import encrypt_voucher_code, mask_voucher_code
import uuid

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────────────────

class VoucherInput(BaseModel):
    code: str
    cost: float
    expiry_date: datetime

class CertVouchersInput(BaseModel):
    cert_id: str
    vouchers: List[VoucherInput]

class AddBudgetInput(BaseModel):
    amount: float

# ── Helpers ──────────────────────────────────────────────────────────

def get_drive_cert_status(drive_id: str, db: Session):
    """Returns cert status for a drive — which have vouchers, which don't."""
    drive_certs = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id
    ).all()

    result = []
    for dc in drive_certs:
        cert = db.query(Certification).filter(
            Certification.id == dc.cert_id
        ).first()
        voucher_count = db.query(Voucher).filter(
            Voucher.drive_id == drive_id,
            Voucher.cert_id == dc.cert_id
        ).count()

        result.append({
            "drive_cert_id": dc.id,
            "cert_id": dc.cert_id,
            "cert_name": cert.name if cert else "Unknown",
            "vouchers_added": dc.vouchers_added,
            "voucher_count": voucher_count,
            "voucher_cost": dc.voucher_cost,
        })
    return result

# ── Routes ───────────────────────────────────────────────────────────

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
        after={"name": drive.name, "status": "draft"}
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
        after={"name": drive.name}
    )
    return drive

@router.get("/{drive_id}/cert-voucher-status")
def get_cert_voucher_status(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    """Get voucher status per certification for a drive."""
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    cert_status = get_drive_cert_status(drive_id, db)
    all_have_vouchers = all(c["vouchers_added"] for c in cert_status)

    return {
        "drive_id": drive_id,
        "drive_name": drive.name,
        "drive_status": drive.status,
        "budget_remaining": drive.budget or 0,
        "certifications": cert_status,
        "can_activate": all_have_vouchers and len(cert_status) > 0,
        "missing_vouchers": [
            c["cert_name"] for c in cert_status
            if not c["vouchers_added"]
        ]
    }

@router.post("/{drive_id}/certifications/{cert_id}/vouchers")
def add_vouchers_for_cert(
    drive_id: str,
    cert_id: str,
    request: CertVouchersInput,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    """
    Admin adds voucher codes for a specific certification in a drive.
    Validates:
    - Unique codes (no duplicates within submission + existing)
    - Expiry date > drive start date
    - Budget sufficient
    """
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    dc = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id,
        DriveCertification.cert_id == cert_id
    ).first()
    if not dc:
        raise HTTPException(
            status_code=404,
            detail="Certification not linked to this drive"
        )

    errors = []
    warnings = []

    # ── Validate each voucher ────────────────────────────────────────
    submitted_codes = [v.code.strip().upper() for v in request.vouchers]

    # Check duplicates within submission
    seen = set()
    duplicate_in_submission = []
    for code in submitted_codes:
        if code in seen:
            duplicate_in_submission.append(code)
        seen.add(code)

    if duplicate_in_submission:
        errors.append({
            "type": "duplicate_in_submission",
            "codes": duplicate_in_submission,
            "message": f"Duplicate codes in your input: {', '.join(duplicate_in_submission)}"
        })

    # Check duplicates in DB (global)
    existing_db_codes = []
    for code in submitted_codes:
        # Check across all vouchers in system
        existing = db.query(Voucher).filter(
            Voucher.masked_code.like(f"%{code[-4:]}")
        ).all()
        for v in existing:
            try:
                from app.core.security import decrypt_voucher_code
                decrypted = decrypt_voucher_code(v.code_encrypted)
                if decrypted.upper() == code:
                    existing_db_codes.append(code)
            except:
                pass

    if existing_db_codes:
        errors.append({
            "type": "duplicate_in_system",
            "codes": existing_db_codes,
            "message": f"Already exists in system: {', '.join(existing_db_codes)}"
        })

    # Check expiry dates
    invalid_expiry = []
    for v in request.vouchers:
        if drive.start_date and v.expiry_date.replace(tzinfo=None) <= drive.start_date:
            invalid_expiry.append(v.code)

    if invalid_expiry:
        errors.append({
            "type": "invalid_expiry",
            "codes": invalid_expiry,
            "message": f"Expiry must be after drive start date ({drive.start_date.date() if drive.start_date else 'N/A'})"
        })

    # Check budget
    total_cost = sum(v.cost for v in request.vouchers)
    current_budget = drive.budget or 0
    if total_cost > current_budget:
        warnings.append({
            "type": "insufficient_budget",
            "message": f"Total cost ₹{total_cost} exceeds remaining budget ₹{current_budget}. Add more budget or remove vouchers.",
            "total_cost": total_cost,
            "budget_remaining": current_budget
        })

    # Return errors before saving
    if errors:
        return {
            "success": False,
            "errors": errors,
            "warnings": warnings
        }

    # ── Save vouchers ────────────────────────────────────────────────
    saved = 0
    for v in request.vouchers:
        code_upper = v.code.strip().upper()
        encrypted = encrypt_voucher_code(code_upper)
        masked = mask_voucher_code(code_upper)

        voucher = Voucher(
            id=str(uuid.uuid4()),
            drive_id=drive_id,
            cert_id=cert_id,
            registration_id=None,
            vendor="Hexaware MAP",
            code_encrypted=encrypted,
            masked_code=masked,
            expiry_date=v.expiry_date.replace(tzinfo=None),
            status="unassigned"
        )
        db.add(voucher)
        saved += 1

    # Deduct from budget
    drive.budget = current_budget - total_cost

    # Mark cert as having vouchers
    dc.vouchers_added = True
    dc.voucher_cost = total_cost / len(request.vouchers) if request.vouchers else 0

    db.commit()

    write_audit_log(
        db=db,
        entity_type="DriveCertification",
        entity_id=dc.id,
        action="vouchers_added",
        actor_id=current_user.id,
        after={
            "cert_id": cert_id,
            "vouchers_added": saved,
            "total_cost": total_cost,
            "budget_remaining": drive.budget
        }
    )

    return {
        "success": True,
        "vouchers_added": saved,
        "total_cost": total_cost,
        "budget_remaining": drive.budget,
        "warnings": warnings
    }

@router.delete("/{drive_id}/certifications/{cert_id}")
def remove_certification_from_drive(
    drive_id: str,
    cert_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    """Remove certification from drive — also removes unassigned vouchers."""
    dc = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id,
        DriveCertification.cert_id == cert_id
    ).first()
    if not dc:
        raise HTTPException(status_code=404, detail="Not found")

    # Refund budget from unassigned vouchers
    unassigned = db.query(Voucher).filter(
        Voucher.drive_id == drive_id,
        Voucher.cert_id == cert_id,
        Voucher.status == "unassigned"
    ).all()

    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if drive and unassigned:
        # Recalculate refund
        refund = sum(dc.voucher_cost or 0 for _ in unassigned)
        drive.budget = (drive.budget or 0) + refund

    # Delete unassigned vouchers only
    db.query(Voucher).filter(
        Voucher.drive_id == drive_id,
        Voucher.cert_id == cert_id,
        Voucher.status == "unassigned"
    ).delete()

    db.delete(dc)
    db.commit()

    return {
        "message": "Certification removed",
        "vouchers_removed": len(unassigned),
        "budget_refunded": refund if drive and unassigned else 0
    }

@router.post("/{drive_id}/budget/add")
def add_drive_budget(
    drive_id: str,
    request: AddBudgetInput,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    """Admin adds more budget to a drive."""
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    old_budget = drive.budget or 0
    drive.budget = old_budget + request.amount
    db.commit()

    write_audit_log(
        db=db,
        entity_type="Drive",
        entity_id=drive_id,
        action="budget_added",
        actor_id=current_user.id,
        before={"budget": old_budget},
        after={"budget": drive.budget, "added": request.amount}
    )

    return {
        "message": f"Budget increased by ₹{request.amount}",
        "old_budget": old_budget,
        "new_budget": drive.budget
    }

@router.patch("/{drive_id}/status")
def update_drive_status(
    drive_id: str,
    status: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    # ── Validate before activation ───────────────────────────────────
    if status == "active":
        cert_status = get_drive_cert_status(drive_id, db)

        if not cert_status:
            raise HTTPException(
                status_code=400,
                detail="Add at least one certification before activating"
            )

        missing = [c["cert_name"] for c in cert_status if not c["vouchers_added"]]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Add vouchers for these certifications first: {', '.join(missing)}"
            )

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

    # Notify candidates when activated
    if status == "active" and before_status != "active":
        from app.models import DriveCertification, Certification
        drive_certs = db.query(DriveCertification).filter(
            DriveCertification.drive_id == drive_id
        ).all()
        cert_names = []
        for dc in drive_certs:
            cert = db.query(Certification).filter(
                Certification.id == dc.cert_id
            ).first()
            if cert:
                cert_names.append(cert.name)

        background_tasks.add_task(
            _notify_all_candidates_drive_activated,
            drive_id=drive_id,
            drive_name=drive.name,
            drive_end_date=str(drive.end_date.date()) if drive.end_date else "TBD",
            cert_names=cert_names
        )

    return {"message": f"Drive status updated to {status}"}


def _notify_all_candidates_drive_activated(
    drive_id: str,
    drive_name: str,
    drive_end_date: str,
    cert_names: list
):
    from app.database import SessionLocal
    from app.services.email_service import send_drive_activation_email
    db = SessionLocal()
    try:
        candidates = db.query(User).filter(User.role == "candidate").all()
        print(f"[DRIVE-NOTIFY] Notifying {len(candidates)} candidates")
        for candidate in candidates:
            try:
                send_drive_activation_email(
                    to_email=candidate.email,
                    name=candidate.name,
                    drive_name=drive_name,
                    certifications=cert_names,
                    end_date=drive_end_date,
                    portal_url="http://localhost:5173/registrations"
                )
            except Exception as e:
                print(f"[DRIVE-NOTIFY] Failed for {candidate.email}: {e}")
    finally:
        db.close()