from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
from app.models import Voucher, Registration, User
from app.services.email_service import send_voucher_email
import uuid

async def auto_allocate_voucher(
    registration_id: str,
    drive_id: str,
    user_id: str,
    db: Session
):
    try:
        # ── Guard 1: already has a voucher? ──────────────────────────
        existing = db.query(Voucher).filter(
            Voucher.registration_id == registration_id
        ).first()
        if existing:
            print(f"[VOUCHER] Already allocated for reg {registration_id}")
            return existing

        # ── Guard 2: atomic row-level lock ───────────────────────────
        # with_for_update() locks the row so two simultaneous
        # pass results cannot both grab the same voucher
        voucher = (
            db.query(Voucher)
            .filter(
                Voucher.drive_id == drive_id,
                Voucher.status == "unassigned",
                Voucher.registration_id == None,
            )
            .with_for_update(skip_locked=True)  # skip rows locked by other tx
            .first()
        )

        if not voucher:
            print(f"[VOUCHER] No unassigned vouchers for drive {drive_id}")
            # Notify coordinator — no vouchers left
            _notify_no_voucher(registration_id, drive_id, db)
            return None

        # ── Guard 3: double-check inside lock ────────────────────────
        # Re-verify registration still has no voucher inside the lock
        still_empty = db.query(Voucher).filter(
            Voucher.registration_id == registration_id
        ).first()
        if still_empty:
            db.rollback()
            return still_empty

        # ── Allocate ─────────────────────────────────────────────────
        token = uuid.uuid4().hex  # 32-char one-time token
        base_url = "http://localhost:5173"
        tokenized_link = f"{base_url}/redeem/{token}"

        voucher.registration_id = registration_id
        voucher.status = "issued"
        voucher.tokenized_link = tokenized_link
        voucher.delivered_at = datetime.utcnow()

        db.flush()   # write within transaction — not committed yet
        db.commit()  # now commit atomically
        db.refresh(voucher)

        print(f"[VOUCHER] Allocated {voucher.id} → reg {registration_id}")

        # ── Send email ───────────────────────────────────────────────
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            send_voucher_email(
                to_email=user.email,
                name=user.name,
                vendor=voucher.vendor or "Certification Vendor",
                tokenized_link=tokenized_link,
                expiry_date=(
                    str(voucher.expiry_date.date())
                    if voucher.expiry_date else "N/A"
                ),
            )

        return voucher

    except Exception as e:
        db.rollback()
        print(f"[VOUCHER] Allocation failed: {e}")
        return None


def _notify_no_voucher(registration_id: str, drive_id: str, db: Session):
    """Notify admins when voucher pool is exhausted."""
    from app.models import Drive
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    drive_name = drive.name if drive else drive_id
    print(
        f"[VOUCHER] ALERT — Pool exhausted for drive '{drive_name}'. "
        f"Registration {registration_id} has no voucher."
    )