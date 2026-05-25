from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Registration, User, Eligibility
from app.services.openai_service import get_ai_eligibility_score

async def evaluate_eligibility(
    registration: Registration,
    db: Session
) -> dict:
    user = db.query(User).filter(
        User.id == registration.user_id
    ).first()

    # --- Rule 1: Tenure check (≥90 days) ---
    tenure_ok = False
    tenure_days = 0
    if user.tenure_start_date:
        tenure_days = (datetime.utcnow() - user.tenure_start_date).days
        tenure_ok = tenure_days >= 90

    # --- Rule 2: Prior attempts check (< 2 in last 365 days) ---
    attempts_ok = registration.prior_attempts < 2

    # --- Rule 3: Basic eligibility (both rules must pass) ---
    rules_passed = tenure_ok and attempts_ok

    # --- Build criteria snapshot ---
    criteria = {
        "tenure_days": tenure_days,
        "tenure_ok": tenure_ok,
        "prior_attempts": registration.prior_attempts,
        "attempts_ok": attempts_ok,
        "rules_passed": rules_passed
    }

    # --- AI scoring via Azure AI Foundry (GPT-5.4-mini) ---
    ai_result = await get_ai_eligibility_score(
        tenure_days=tenure_days,
        prior_attempts=registration.prior_attempts,
        exam_track=registration.exam_track or "General",
        rules_passed=rules_passed
    )

    # --- Final decision ---
    # Rules are mandatory. AI score is advisory.
    # If rules fail → ineligible regardless of AI score
    # If rules pass → use AI score (>= 0.5 = eligible)
    if not rules_passed:
        decision = "ineligible"
    elif ai_result["score"] >= 0.5:
        decision = "eligible"
    else:
        decision = "pending_approval"

    return {
        "decision": decision,
        "ai_score": ai_result["score"],
        "reasons": ai_result["reasons"],
        "criteria": criteria
    }