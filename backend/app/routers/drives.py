
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Drive
from app.schemas import DriveCreate, DriveResponse
from app.auth import get_current_user, require_role
from app.core.audit_logger import write_audit_log

# Voucher generation imports
from app.services.voucher_generator import (
    generate_unique_voucher_codes,
    calculate_voucher_distribution
)
from app.core.security import encrypt_voucher_code, mask_voucher_code
from app.models import Certification, DriveCertification, Voucher, ExamSlot
import uuid
from datetime import datetime, timedelta

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
async def create_drive(
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


# --- Generate vouchers for all certifications in a drive ---
@router.post("/{drive_id}/generate-vouchers")
async def generate_drive_vouchers(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    """
    Auto-generate vouchers for all certifications in a drive.
    Called after certifications are linked.
    """
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    if not drive.budget or drive.budget <= 0:
        raise HTTPException(
            status_code=400,
            detail="Drive must have a budget to generate vouchers"
        )

    # Get certifications linked to this drive
    drive_certs = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id
    ).all()

    if not drive_certs:
        raise HTTPException(
            status_code=400,
            detail="Link certifications to drive before generating vouchers"
        )

    cert_names = []
    cert_map = {}
    for dc in drive_certs:
        cert = db.query(Certification).filter(
            Certification.id == dc.cert_id
        ).first()
        if cert:
            cert_names.append(cert.name)
            cert_map[cert.name] = cert.id

    # Calculate distribution
    distribution = calculate_voucher_distribution(
        budget=drive.budget,
        cert_names=cert_names,
        voucher_cost=1000
    )

    # Get existing codes to avoid duplicates
    existing = db.query(Voucher).with_entities(
        Voucher.masked_code
    ).all()
    existing_codes = [v[0] for v in existing if v[0]]

    total_generated = 0
    result = []
    expiry = drive.end_date or (datetime.utcnow() + timedelta(days=90))

    for cert_name, count in distribution.items():
        cert_id = cert_map.get(cert_name)

        # Check existing vouchers for this cert in this drive
        existing_for_cert = db.query(Voucher).filter(
            Voucher.drive_id == drive_id,
            Voucher.cert_id == cert_id
        ).count()

        if existing_for_cert >= count:
            result.append({
                "cert": cert_name,
                "already_exists": existing_for_cert,
                "generated": 0
            })
            continue

        to_generate = count - existing_for_cert

        # AI generates unique codes
        codes = await generate_unique_voucher_codes(
            count=to_generate,
            cert_name=cert_name,
            drive_name=drive.name,
            existing_codes=existing_codes
        )

        for code in codes:
            encrypted = encrypt_voucher_code(code)
            masked = mask_voucher_code(code)
            existing_codes.append(code)  # track to avoid dups

            voucher = Voucher(
                id=str(uuid.uuid4()),
                drive_id=drive_id,
                cert_id=cert_id,
                registration_id=None,
                vendor="Hexaware MAP",
                code_encrypted=encrypted,
                masked_code=masked,
                expiry_date=expiry,
                status="unassigned"
            )
            db.add(voucher)
            total_generated += 1

        db.commit()
        result.append({
            "cert": cert_name,
            "vouchers_generated": to_generate,
            "total_for_cert": count
        })

    write_audit_log(
        db=db,
        entity_type="Drive",
        entity_id=drive_id,
        action="vouchers_generated",
        actor_id=current_user.id,
        after={"total_generated": total_generated, "distribution": result}
    )

    return {
        "drive_id": drive_id,
        "total_generated": total_generated,
        "budget": drive.budget,
        "distribution": result
    }


# --- Add more vouchers to a drive ---
@router.post("/{drive_id}/add-vouchers")
async def add_more_vouchers(
    drive_id: str,
    additional_budget: float,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    """
    Admin adds more budget → auto-generates additional vouchers.
    Also increases overall drive budget.
    """
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    if additional_budget <= 0:
        raise HTTPException(
            status_code=400,
            detail="Additional budget must be greater than 0"
        )

    # Get certs that are exhausted (all vouchers redeemed)
    drive_certs = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id
    ).all()

    exhausted_certs = []
    cert_map = {}

    for dc in drive_certs:
        cert = db.query(Certification).filter(
            Certification.id == dc.cert_id
        ).first()
        if not cert:
            continue

        cert_map[cert.name] = cert.id

        # Check unassigned vouchers for this cert
        unassigned = db.query(Voucher).filter(
            Voucher.drive_id == drive_id,
            Voucher.cert_id == cert.id,
            Voucher.status == "unassigned"
        ).count()

        if unassigned == 0:
            exhausted_certs.append(cert.name)

    if not exhausted_certs:
        # Distribute across all certs if none exhausted
        exhausted_certs = list(cert_map.keys())

    # Calculate new vouchers from additional budget
    distribution = calculate_voucher_distribution(
        budget=additional_budget,
        cert_names=exhausted_certs,
        voucher_cost=1000
    )

    # Get existing codes
    existing = db.query(Voucher).with_entities(Voucher.masked_code).all()
    existing_codes = [v[0] for v in existing if v[0]]

    total_generated = 0
    result = []
    expiry = drive.end_date or (datetime.utcnow() + timedelta(days=90))

    for cert_name, count in distribution.items():
        cert_id = cert_map.get(cert_name)
        if not cert_id:
            continue

        codes = await generate_unique_voucher_codes(
            count=count,
            cert_name=cert_name,
            drive_name=drive.name,
            existing_codes=existing_codes
        )

        for code in codes:
            encrypted = encrypt_voucher_code(code)
            masked = mask_voucher_code(code)
            existing_codes.append(code)

            voucher = Voucher(
                id=str(uuid.uuid4()),
                drive_id=drive_id,
                cert_id=cert_id,
                registration_id=None,
                vendor="Hexaware MAP",
                code_encrypted=encrypted,
                masked_code=masked,
                expiry_date=expiry,
                status="unassigned"
            )
            db.add(voucher)
            total_generated += 1

        result.append({
            "cert": cert_name,
            "new_vouchers": count
        })

    # ── Increase drive budget ────────────────────────────────────────
    old_budget = drive.budget or 0
    drive.budget = old_budget + additional_budget
    db.commit()

    write_audit_log(
        db=db,
        entity_type="Drive",
        entity_id=drive_id,
        action="vouchers_added",
        actor_id=current_user.id,
        before={"budget": old_budget},
        after={
            "budget": drive.budget,
            "additional_budget": additional_budget,
            "vouchers_generated": total_generated
        }
    )

    return {
        "drive_id": drive_id,
        "additional_budget": additional_budget,
        "new_total_budget": drive.budget,
        "vouchers_generated": total_generated,
        "distribution": result
    }

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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    from fastapi import BackgroundTasks
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

    # ── Notify ALL candidates when drive activated ───────────────────
    if status == "active" and before_status != "active":
        background_tasks.add_task(
            _notify_all_candidates_drive_activated,
            drive_id=drive_id,
            drive_name=drive.name,
            drive_end_date=str(drive.end_date.date()) if drive.end_date else "TBD"
        )

    return {"message": f"Drive status updated to {status}"}


def _notify_all_candidates_drive_activated(
    drive_id: str,
    drive_name: str,
    drive_end_date: str
):
    """Notify all candidates in system when drive is activated."""
    from app.database import SessionLocal
    from app.services.email_service import send_drive_activation_email

    db = SessionLocal()
    try:
        candidates = db.query(User).filter(
            User.role == "candidate"
        ).all()

        # Get certifications for this drive
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

        print(
            f"[DRIVE-NOTIFY] Notifying {len(candidates)} "
            f"candidates about {drive_name}"
        )

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
                print(
                    f"[DRIVE-NOTIFY] Failed for {candidate.email}: {e}"
                )
    finally:
        db.close()