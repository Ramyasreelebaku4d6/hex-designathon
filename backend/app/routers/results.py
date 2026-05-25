from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import AssessmentResult, Registration, Voucher
from app.schemas import ResultCreate, ResultResponse
from app.auth import require_role, get_current_user
from app.core.audit_logger import write_audit_log
from app.services.voucher_service import auto_allocate_voucher

router = APIRouter()

@router.post("/", response_model=ResultResponse)
async def create_result(
    request: ResultCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    reg = db.query(Registration).filter(
        Registration.id == request.registration_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    # ── Check duplicate result ───────────────────────────────────────
    existing = db.query(AssessmentResult).filter(
        AssessmentResult.registration_id == request.registration_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Result already exists for this registration"
        )

    # ── Get drive pass threshold ─────────────────────────────────────
    from app.models import Drive
    drive = db.query(Drive).filter(Drive.id == reg.drive_id).first()
    pass_threshold = drive.pass_threshold if drive else 70.0

    # ── Validate outcome against threshold ──────────────────────────
    # Override outcome based on actual score vs threshold
    actual_outcome = (
        "pass" if request.score >= pass_threshold else "fail"
    )
    if request.outcome != actual_outcome:
        print(
            f"[RESULT] Outcome overridden: "
            f"submitted='{request.outcome}' → "
            f"actual='{actual_outcome}' "
            f"(score={request.score}, threshold={pass_threshold})"
        )

    result = AssessmentResult(
        registration_id=request.registration_id,
        score=request.score,
        outcome=actual_outcome,  # use validated outcome
        evidence_url=request.evidence_url,
        exam_date=request.exam_date or datetime.utcnow()
    )
    db.add(result)

    # ── Update registration status ───────────────────────────────────
    reg.status = f"result_{actual_outcome}"
    db.commit()
    db.refresh(result)

    # ── Auto allocate voucher only if truly passed ───────────────────
    if actual_outcome == "pass":
        await auto_allocate_voucher(
            registration_id=request.registration_id,
            drive_id=reg.drive_id,
            user_id=reg.user_id,
            db=db
        )
    else:
        # ── Failed — check retake eligibility ───────────────────────
        # Increment prior attempts so next registration
        # is checked against attempt limit
        reg.prior_attempts = (reg.prior_attempts or 0) + 1
        db.commit()

        # Notify candidate of failure + retake info
        from app.models import User
        from app.services.email_service import send_email
        user = db.query(User).filter(User.id == reg.user_id).first()
        if user:
            attempts_remaining = max(0, 2 - reg.prior_attempts)
            subject = f"Assessment Result — {reg.exam_track or 'Certification'}"
            body = f"""
            <html><body>
            <h2>Hi {user.name},</h2>
            <p>Your assessment result for <strong>
            {reg.exam_track or 'the certification'}
            </strong> has been recorded.</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f3f4f6;">
                <td style="padding:8px 12px;font-weight:600;">Score</td>
                <td style="padding:8px 12px;">{request.score}%</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:600;">Pass Threshold</td>
                <td style="padding:8px 12px;">{pass_threshold}%</td>
              </tr>
              <tr style="background:#f3f4f6;">
                <td style="padding:8px 12px;font-weight:600;">Outcome</td>
                <td style="padding:8px 12px;color:red;font-weight:600;">
                  Did not pass
                </td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:600;">
                  Retake Attempts Left
                </td>
                <td style="padding:8px 12px;">{attempts_remaining}</td>
              </tr>
            </table>
            {"<p>You may re-register for the next available drive.</p>" 
              if attempts_remaining > 0 
              else "<p>You have reached the maximum attempt limit.</p>"}
            <br/><p>Regards,<br/>Maverick Certification Hub</p>
            </body></html>
            """
            send_email(user.email, subject, body)

    write_audit_log(
        db=db,
        entity_type="AssessmentResult",
        entity_id=result.id,
        action="result_imported",
        actor_id=current_user.id,
        after={
            "outcome": actual_outcome,
            "score": request.score,
            "threshold": pass_threshold
        }
    )
    return result
    
@router.get("/", response_model=List[ResultResponse])
def get_results(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.role == "candidate":
        regs = db.query(Registration).filter(
            Registration.user_id == current_user.id
        ).all()
        reg_ids = [r.id for r in regs]
        return db.query(AssessmentResult).filter(
            AssessmentResult.registration_id.in_(reg_ids)
        ).all()
    return db.query(AssessmentResult).all()