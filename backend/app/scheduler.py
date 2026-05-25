from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import Voucher, Registration, User
from app.services.email_service import send_reminder_email

def send_voucher_reminders():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        reminder_days = [30, 7, 3]

        for days in reminder_days:
            target_date = now + timedelta(days=days)
            vouchers = db.query(Voucher).filter(
                Voucher.status == "issued",
                Voucher.expiry_date >= target_date.replace(hour=0, minute=0),
                Voucher.expiry_date <= target_date.replace(hour=23, minute=59)
            ).all()

            for voucher in vouchers:
                if voucher.registration_id:
                    reg = db.query(Registration).filter(
                        Registration.id == voucher.registration_id
                    ).first()
                    if reg:
                        user = db.query(User).filter(
                            User.id == reg.user_id
                        ).first()
                        if user:
                            send_reminder_email(
                                to_email=user.email,
                                name=user.name,
                                vendor=voucher.vendor or "Vendor",
                                days_left=days,
                                tokenized_link=voucher.tokenized_link or ""
                            )
                            print(
                                f"Reminder sent to {user.email} "
                                f"— {days} days left"
                            )
    except Exception as e:
        print(f"Reminder job failed: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run every day at 9 AM
    scheduler.add_job(
        send_voucher_reminders,
        "cron",
        hour=9,
        minute=0,
        id="voucher_reminders"
    )
    scheduler.start()
    print("Scheduler started — reminders will run daily at 9 AM")
    return scheduler