from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Registration, User, Eligibility, DriveCertification
from app.services.openai_service import get_ai_eligibility_score

async def evaluate_eligibility(
    registration: Registration,
    db: Session
) -> dict:
    from app.models import Voucher

    user = db.query(User).filter(
        User.id == registration.user_id
    ).first()

    # ── Rule 1: Tenure ───────────────────────────────────────────────
    tenure_ok = False
    tenure_days = 0
    if user.tenure_start_date:
        tenure_days = (datetime.utcnow() - user.tenure_start_date).days
        tenure_ok = tenure_days >= 90

    # ── Rule 2: Attempt limit ────────────────────────────────────────
    # Each redeemed voucher for the same cert counts as 1 attempt.
    cutoff = datetime.utcnow() - timedelta(days=365)

    all_user_regs = db.query(Registration).filter(
        Registration.user_id == registration.user_id,
        Registration.id != registration.id,
    ).all()

    same_cert_reg_ids = [
        r.id for r in all_user_regs
        if (
            (registration.cert_id and r.cert_id == registration.cert_id) or
            (registration.exam_track and r.exam_track and
             registration.exam_track.lower() == r.exam_track.lower())
        )
    ]

    actual_attempts = 0
    if same_cert_reg_ids:
        actual_attempts = db.query(Voucher).filter(
            Voucher.registration_id.in_(same_cert_reg_ids),
            Voucher.status == "redeemed",
            Voucher.redeemed_at >= cutoff,
        ).count()

    attempts_ok = actual_attempts < 2

    # ── Rule 3: Cert in drive list ───────────────────────────────────
    cert_in_drive_list = False
    if registration.cert_id:
        drive_cert = db.query(DriveCertification).filter(
            DriveCertification.drive_id == registration.drive_id,
            DriveCertification.cert_id == registration.cert_id
        ).first()
        cert_in_drive_list = drive_cert is not None

    is_custom_cert = registration.is_custom_cert or (
        registration.custom_cert_name and not registration.cert_id
    )

    rules_passed = tenure_ok and attempts_ok

    criteria = {
        "tenure_days": tenure_days,
        "tenure_ok": tenure_ok,
        "actual_attempts": actual_attempts,
        "attempts_ok": attempts_ok,
        "cert_in_drive_list": cert_in_drive_list,
        "is_custom_cert": is_custom_cert,
        "rules_passed": rules_passed
    }

    # Custom cert → always pending approval
    if is_custom_cert:
        return {
            "decision": "pending_approval",
            "ai_score": 0.5,
            "reasons": [
                "Custom certification requires manual approver review",
                f"Certification '{registration.custom_cert_name}' not in approved list",
                "Approver will verify certification eligibility"
            ],
            "criteria": criteria
        }

    # Get AI score
    ai_result = await get_ai_eligibility_score(
        tenure_days=tenure_days,
        prior_attempts=actual_attempts,
        exam_track=registration.exam_track or "General",
        rules_passed=rules_passed
    )

    # Decision
    if not rules_passed:
        decision = "ineligible"
    elif cert_in_drive_list and ai_result["score"] >= 0.5:
        decision = "eligible"
    else:
        decision = "pending_approval"

    return {
        "decision": decision,
        "ai_score": ai_result["score"],
        "reasons": ai_result["reasons"],
        "criteria": criteria
    }