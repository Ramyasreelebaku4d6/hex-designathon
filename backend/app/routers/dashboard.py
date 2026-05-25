from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Drive, Registration, Eligibility, AssessmentResult, Voucher
from app.auth import get_current_user
from app.schemas import DashboardStats

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    total_drives = db.query(Drive).count()
    total_registrations = db.query(Registration).count()
    eligible_count = db.query(Eligibility).filter(
        Eligibility.decision == "eligible"
    ).count()
    passed_count = db.query(AssessmentResult).filter(
        AssessmentResult.outcome == "pass"
    ).count()
    vouchers_issued = db.query(Voucher).filter(
        Voucher.status == "issued"
    ).count()
    vouchers_redeemed = db.query(Voucher).filter(
        Voucher.status == "redeemed"
    ).count()

    return DashboardStats(
        total_drives=total_drives,
        total_registrations=total_registrations,
        eligible_count=eligible_count,
        passed_count=passed_count,
        vouchers_issued=vouchers_issued,
        vouchers_redeemed=vouchers_redeemed
    )

@router.get("/drive-funnel")
def get_drive_funnel(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    total = db.query(Registration).count()
    eligible = db.query(Eligibility).filter(
        Eligibility.decision == "eligible"
    ).count()
    passed = db.query(AssessmentResult).filter(
        AssessmentResult.outcome == "pass"
    ).count()
    vouchers = db.query(Voucher).filter(
        Voucher.status.in_(["issued", "redeemed"])
    ).count()
    redeemed = db.query(Voucher).filter(
        Voucher.status == "redeemed"
    ).count()

    return [
        {"stage": "Registered", "count": total},
        {"stage": "Eligible", "count": eligible},
        {"stage": "Passed", "count": passed},
        {"stage": "Voucher Issued", "count": vouchers},
        {"stage": "Voucher Redeemed", "count": redeemed},
    ]

@router.get("/pass-fail")
def get_pass_fail(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    passed = db.query(AssessmentResult).filter(
        AssessmentResult.outcome == "pass"
    ).count()
    failed = db.query(AssessmentResult).filter(
        AssessmentResult.outcome == "fail"
    ).count()
    return [
        {"outcome": "Pass", "count": passed},
        {"outcome": "Fail", "count": failed}
    ]