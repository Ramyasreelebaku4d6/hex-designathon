from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Certification, DriveCertification, Drive, Voucher
from app.schemas import CertificationResponse, DriveCertificationAdd
from app.auth import get_current_user, require_role
import uuid

router = APIRouter()

@router.get("/", response_model=List[CertificationResponse])
def search_certifications(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Certification)
    if search:
        query = query.filter(
            Certification.name.ilike(f"%{search}%")
        )
    return query.order_by(Certification.name).all()

@router.post("/", response_model=CertificationResponse)
def create_certification(
    name: str,
    code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    # Check if cert already exists
    existing = db.query(Certification).filter(
        Certification.name.ilike(name)
    ).first()
    if existing:
        return existing

    cert = Certification(
        id=str(uuid.uuid4()),
        name=name,
        code=code,
        is_custom=False,
        created_by=current_user.id
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert

@router.get("/drives/{drive_id}/available")
def get_available_drive_certifications(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Returns only certifications that have at least one unassigned voucher for this drive."""
    from sqlalchemy import func

    # Single query: count unassigned vouchers grouped by cert_id
    available_counts = dict(
        db.query(Voucher.cert_id, func.count(Voucher.id))
        .filter(Voucher.drive_id == drive_id, Voucher.status == "unassigned")
        .group_by(Voucher.cert_id)
        .all()
    )

    drive_certs = (
        db.query(DriveCertification)
        .filter(DriveCertification.drive_id == drive_id)
        .all()
    )

    return [
        {
            "id": dc.certification.id,
            "name": dc.certification.name,
            "code": dc.certification.code,
            "is_custom": dc.certification.is_custom,
        }
        for dc in drive_certs
        if dc.certification and available_counts.get(dc.cert_id, 0) > 0
    ]


@router.get("/drives/{drive_id}", response_model=List[CertificationResponse])
def get_drive_certifications(
    drive_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    drive_certs = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id
    ).all()
    return [dc.certification for dc in drive_certs]

@router.post("/drives/{drive_id}")
def add_certification_to_drive(
    drive_id: str,
    request: DriveCertificationAdd,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    cert_id = request.cert_id

    # If no cert_id given — create a new certification
    if not cert_id and request.name:
        existing = db.query(Certification).filter(
            Certification.name.ilike(request.name)
        ).first()
        if existing:
            cert_id = existing.id
        else:
            new_cert = Certification(
                id=str(uuid.uuid4()),
                name=request.name,
                code=request.code,
                is_custom=False,
                created_by=current_user.id
            )
            db.add(new_cert)
            db.commit()
            db.refresh(new_cert)
            cert_id = new_cert.id

    # Check if already linked
    already = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id,
        DriveCertification.cert_id == cert_id
    ).first()
    if already:
        return {"message": "Certification already linked to this drive"}

    dc = DriveCertification(
        id=str(uuid.uuid4()),
        drive_id=drive_id,
        cert_id=cert_id,
        added_by=current_user.id
    )
    db.add(dc)
    db.commit()
    return {"message": "Certification linked successfully", "cert_id": cert_id}

@router.delete("/drives/{drive_id}/{cert_id}")
def remove_certification_from_drive(
    drive_id: str,
    cert_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    dc = db.query(DriveCertification).filter(
        DriveCertification.drive_id == drive_id,
        DriveCertification.cert_id == cert_id
    ).first()
    if not dc:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(dc)
    db.commit()
    return {"message": "Removed"}