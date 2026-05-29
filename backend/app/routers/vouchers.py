from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import Voucher
from app.schemas import VoucherCreate, VoucherResponse
from app.auth import require_role, get_current_user
from app.core.security import encrypt_voucher_code, decrypt_voucher_code, mask_voucher_code
from app.core.audit_logger import write_audit_log
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/pool", response_model=VoucherResponse)
def add_voucher_to_pool(
    request: VoucherCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    voucher = Voucher(
        drive_id=request.drive_id,
        vendor=request.vendor,
        code_encrypted=encrypt_voucher_code(request.code),
        masked_code=mask_voucher_code(request.code),
        expiry_date=request.expiry_date,
        status="unassigned"
    )
    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    write_audit_log(
        db=db,
        entity_type="Voucher",
        entity_id=voucher.id,
        action="added_to_pool",
        actor_id=current_user.id,
        after={"vendor": request.vendor, "status": "unassigned"}
    )
    return voucher

@router.get("/", response_model=List[VoucherResponse])
def get_vouchers(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    return db.query(Voucher).all()

@router.get("/redeem/{token}")
def redeem_voucher(
    token: str,
    db: Session = Depends(get_db)
):
    # ── Find voucher by token ────────────────────────────────────────
    voucher = db.query(Voucher).filter(
        Voucher.tokenized_link.contains(token)
    ).first()

    # ── Validate ─────────────────────────────────────────────────────
    if not voucher:
        raise HTTPException(
            status_code=404,
            detail="Invalid redemption link. This link does not exist."
        )
    if voucher.status == "redeemed":
        raise HTTPException(
            status_code=400,
            detail="This voucher has already been redeemed. Each link works only once."
        )
    if voucher.status == "revoked":
        raise HTTPException(
            status_code=400,
            detail="This voucher has been revoked. Contact your coordinator."
        )
    if voucher.status == "expired":
        raise HTTPException(
            status_code=400,
            detail="This voucher has expired."
        )

    # ── Expiry check ─────────────────────────────────────────────────
    if voucher.expiry_date and voucher.expiry_date < datetime.utcnow():
        voucher.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="This voucher has expired."
        )

    # ── Mark as redeemed FIRST before returning code ─────────────────
    # This prevents race condition where two requests hit simultaneously
    voucher.status = "redeemed"
    voucher.redeemed_at = datetime.utcnow()
    # Invalidate the token link so it can never be used again
    voucher.tokenized_link = f"REDEEMED_{token}"
    # Update registration status to voucher_redeemed
    if voucher.registration_id:
        from app.models import Registration
        reg = db.query(Registration).filter(
            Registration.id == voucher.registration_id
        ).first()
        if reg:
            reg.status = "voucher_redeemed"
    db.commit()

    # ── Decrypt and return ───────────────────────────────────────────
    try:
        decrypted_code = decrypt_voucher_code(voucher.code_encrypted)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to decrypt voucher. Contact administrator."
        )

    return {
        "vendor": voucher.vendor,
        "code": decrypted_code,
        "expiry_date": voucher.expiry_date,
        "message": "Voucher successfully redeemed. Save this code — this page will not show it again."
    }

@router.patch("/{voucher_id}/revoke")
def revoke_voucher(
    voucher_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    voucher.status = "revoked"
    db.commit()
    write_audit_log(
        db=db,
        entity_type="Voucher",
        entity_id=voucher_id,
        action="revoked",
        actor_id=current_user.id,
        before={"status": "issued"},
        after={"status": "revoked"}
    )
    return {"message": "Voucher revoked successfully"}