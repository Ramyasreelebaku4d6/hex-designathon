from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import Voucher, Registration, User
from app.services.email_service import send_reminder_email


def _get_user_for_voucher(voucher, db):
    """Return the User linked to a voucher's registration, or None."""
    if not voucher.registration_id:
        return None
    reg = db.query(Registration).filter(
        Registration.id == voucher.registration_id
    ).first()
    if not reg:
        return None
    return db.query(User).filter(User.id == reg.user_id).first()


def send_expiry_reminders():
    """Send reminders 30 days and 7 days before voucher expiry."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        for days in [30, 7]:
            target_date = now + timedelta(days=days)
            vouchers = db.query(Voucher).filter(
                Voucher.status == "issued",
                Voucher.expiry_date >= target_date.replace(hour=0, minute=0, second=0),
                Voucher.expiry_date <= target_date.replace(hour=23, minute=59, second=59),
            ).all()

            for voucher in vouchers:
                user = _get_user_for_voucher(voucher, db)
                if user:
                    send_reminder_email(
                        to_email=user.email,
                        name=user.name,
                        vendor=voucher.vendor or "Vendor",
                        days_left=days,
                        tokenized_link=voucher.tokenized_link or "",
                    )
                    print(f"[REMINDER] Expiry reminder sent to {user.email} — {days} days left")
    except Exception as e:
        print(f"[REMINDER] Expiry reminder job failed: {e}")
    finally:
        db.close()


def send_post_allocation_reminders():
    """Send a reminder 3 days after the voucher was allocated."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        window_start = now - timedelta(days=3, hours=1)
        window_end   = now - timedelta(days=3) + timedelta(hours=1)

        vouchers = db.query(Voucher).filter(
            Voucher.status == "issued",
            Voucher.delivered_at >= window_start,
            Voucher.delivered_at <= window_end,
        ).all()

        for voucher in vouchers:
            user = _get_user_for_voucher(voucher, db)
            if user:
                send_reminder_email(
                    to_email=user.email,
                    name=user.name,
                    vendor=voucher.vendor or "Vendor",
                    days_left=None,
                    tokenized_link=voucher.tokenized_link or "",
                    post_allocation=True,
                )
                print(f"[REMINDER] Post-allocation reminder sent to {user.email} (3 days after issue)")
    except Exception as e:
        print(f"[REMINDER] Post-allocation reminder job failed: {e}")
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        send_expiry_reminders,
        "cron",
        hour=9,
        minute=0,
        id="expiry_reminders",
    )
    scheduler.add_job(
        send_post_allocation_reminders,
        "cron",
        hour=9,
        minute=0,
        id="post_allocation_reminders",
    )
    scheduler.start()
    print("Scheduler started — expiry & post-allocation reminders will run daily at 9 AM")
    return scheduler