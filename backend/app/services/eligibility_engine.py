from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Registration, User, Eligibility, DriveCertification
from app.services.openai_service import get_ai_eligibility_score

async def evaluate_eligibility(
    registration: Registration,
    db: Session
) -> dict:
    user = db.query(User).filter(
        User.id == registration.user_id
    ).first()

    # ── Rule 1: Tenure check (≥90 days) ─────────────────────────────
    tenure_ok = False
    tenure_days = 0
    if user.tenure_start_date:
        tenure_days = (datetime.utcnow() - user.tenure_start_date).days
        tenure_ok = tenure_days >= 90

    # ── Rule 2: Attempt limit (< 2 in any previous drive) ───────────
    attempts_ok = registration.prior_attempts < 2

    # ── Rule 3: Is cert in drive's approved list? ────────────────────
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
        "prior_attempts": registration.prior_attempts,
        "attempts_ok": attempts_ok,
        "cert_in_drive_list": cert_in_drive_list,
        "is_custom_cert": is_custom_cert,
        "rules_passed": rules_passed
    }

    # ── If custom cert → always goes to approver ────────────────────
    if is_custom_cert:
        return {
            "decision": "pending_approval",
            "ai_score": 0.5,
            "reasons": [
                "Custom certification requires manual approver review",
                f"Certification '{registration.custom_cert_name}' is not in the drive's approved list",
                "Approver will verify certification eligibility"
            ],
            "criteria": criteria
        }

    # ── Get AI score ─────────────────────────────────────────────────
    ai_result = await get_ai_eligibility_score(
        tenure_days=tenure_days,
        prior_attempts=registration.prior_attempts,
        exam_track=registration.exam_track or "General",
        rules_passed=rules_passed
    )

    # ── Decision logic ───────────────────────────────────────────────
    # Custom cert → always pending_approval (handled above)
    # Rules failed → ineligible
    # Cert in drive list + rules passed + AI ≥ 0.5 → auto-approved
    # Cert in drive list + rules passed + AI < 0.5 → pending_approval
    if not rules_passed:
        decision = "ineligible"
    elif cert_in_drive_list and ai_result["score"] >= 0.5:
        decision = "eligible"  # auto-approved, no human needed
    elif cert_in_drive_list and ai_result["score"] < 0.5:
        decision = "pending_approval"
    else:
        decision = "pending_approval"

    return {
        "decision": decision,
        "ai_score": ai_result["score"],
        "reasons": ai_result["reasons"],
        "criteria": criteria
    }