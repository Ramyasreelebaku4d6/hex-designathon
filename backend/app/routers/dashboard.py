from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    Drive, Registration, Eligibility,
    AssessmentResult, Voucher, User, AuditLog
)
from app.auth import get_current_user

router = APIRouter()

# ── Shared helpers ───────────────────────────────────────────────────

def _base_stats(db):
    return {
        "total_drives": db.query(Drive).count(),
        "active_drives": db.query(Drive).filter(Drive.status == "active").count(),
        "total_registrations": db.query(Registration).count(),
        "eligible_count": db.query(Eligibility).filter(Eligibility.decision == "eligible").count(),
        "passed_count": db.query(AssessmentResult).filter(AssessmentResult.outcome == "pass").count(),
        "failed_count": db.query(AssessmentResult).filter(AssessmentResult.outcome == "fail").count(),
        "vouchers_issued": db.query(Voucher).filter(Voucher.status == "issued").count(),
        "vouchers_redeemed": db.query(Voucher).filter(Voucher.status == "redeemed").count(),
        "vouchers_unassigned": db.query(Voucher).filter(Voucher.status == "unassigned").count(),
    }

# ── Admin dashboard ──────────────────────────────────────────────────

@router.get("/admin")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    stats = _base_stats(db)

    # Budget spent — sum of drive budgets for active/closed drives
    budget_total = db.query(func.sum(Drive.budget)).filter(
        Drive.status.in_(["active", "closed"])
    ).scalar() or 0

    # ROI — cost per certified candidate
    passed = stats["passed_count"]
    roi = round(budget_total / passed, 2) if passed > 0 else 0

    # SLA compliance — registrations with ACK sent
    total_reg = stats["total_registrations"]
    ack_sent = db.query(Registration).filter(
        Registration.ack_email_sent_at != None
    ).count()
    sla_pct = round((ack_sent / total_reg * 100), 1) if total_reg > 0 else 0

    # Ineligible count
    ineligible = db.query(Eligibility).filter(
        Eligibility.decision == "ineligible"
    ).count()

    return {
        **stats,
        "budget_total": budget_total,
        "roi_cost_per_certified": roi,
        "sla_compliance_pct": sla_pct,
        "ineligible_count": ineligible,
        "total_users": db.query(User).filter(User.role == "candidate").count(),
    }

# ── Coordinator dashboard ────────────────────────────────────────────

@router.get("/coordinator")
def coordinator_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    last_week_start = now - timedelta(days=14)

    # Pending eligibility evaluations
    pending_eval = db.query(Registration).filter(
        Registration.status == "submitted"
    ).count()

    # Registrations this week
    reg_this_week = db.query(Registration).filter(
        Registration.created_at >= week_ago
    ).count()

    # Registrations last week (for comparison)
    reg_last_week = db.query(Registration).filter(
        Registration.created_at >= last_week_start,
        Registration.created_at < week_ago
    ).count()

    # Vouchers expiring in 7 days
    expiring_soon = db.query(Voucher).filter(
        Voucher.status == "issued",
        Voucher.expiry_date <= now + timedelta(days=7),
        Voucher.expiry_date >= now
    ).count()

    # Pending approvals
    pending_approval = db.query(Eligibility).filter(
        Eligibility.decision == "pending_approval"
    ).count()

    # Recent registrations (last 5)
    recent_regs = db.query(Registration).order_by(
        Registration.created_at.desc()
    ).limit(5).all()

    recent_list = []
    for r in recent_regs:
        user = db.query(User).filter(User.id == r.user_id).first()
        drive = db.query(Drive).filter(Drive.id == r.drive_id).first()
        recent_list.append({
            "id": r.id,
            "candidate_name": user.name if user else "Unknown",
            "drive_name": drive.name if drive else "Unknown",
            "exam_track": r.exam_track,
            "status": r.status,
            "created_at": r.created_at,
        })

    # Unallocated vouchers (passed but no voucher)
    passed_regs = db.query(AssessmentResult).filter(
        AssessmentResult.outcome == "pass"
    ).all()
    pass_reg_ids = [r.registration_id for r in passed_regs]
    unallocated = 0
    for rid in pass_reg_ids:
        v = db.query(Voucher).filter(Voucher.registration_id == rid).first()
        if not v:
            unallocated += 1

    return {
        "pending_evaluations": pending_eval,
        "pending_approvals": pending_approval,
        "registrations_this_week": reg_this_week,
        "registrations_last_week": reg_last_week,
        "vouchers_expiring_7_days": expiring_soon,
        "unallocated_vouchers": unallocated,
        "recent_registrations": recent_list,
        **_base_stats(db),
    }

# ── Approver dashboard ───────────────────────────────────────────────

@router.get("/approver")
def approver_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    month_ago = datetime.utcnow() - timedelta(days=30)

    # My approval queue
    pending = db.query(Eligibility).filter(
        Eligibility.decision == "pending_approval"
    ).all()

    queue = []
    for e in pending:
        reg = db.query(Registration).filter(
            Registration.id == e.registration_id
        ).first()
        user = db.query(User).filter(
            User.id == reg.user_id
        ).first() if reg else None
        drive = db.query(Drive).filter(
            Drive.id == reg.drive_id
        ).first() if reg else None
        queue.append({
            "eligibility_id": e.id,
            "registration_id": e.registration_id,
            "candidate_name": user.name if user else "Unknown",
            "candidate_email": user.email if user else "",
            "business_unit": user.business_unit if user else "",
            "exam_track": reg.exam_track if reg else "",
            "drive_name": drive.name if drive else "",
            "ai_score": e.ai_score,
            "ai_reasons": e.ai_reasons,
            "created_at": reg.created_at if reg else None,
        })

    # My approval history this month
    my_approved = db.query(Eligibility).filter(
        Eligibility.approver_id == current_user.id,
        Eligibility.decision == "eligible",
        Eligibility.decision_date >= month_ago
    ).count()

    my_rejected = db.query(Eligibility).filter(
        Eligibility.approver_id == current_user.id,
        Eligibility.decision == "ineligible",
        Eligibility.decision_date >= month_ago
    ).count()

    return {
        "pending_queue": queue,
        "pending_count": len(queue),
        "approved_this_month": my_approved,
        "rejected_this_month": my_rejected,
    }

# ── Candidate dashboard ──────────────────────────────────────────────

@router.get("/candidate")
def candidate_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # All my registrations
    my_regs = db.query(Registration).filter(
        Registration.user_id == current_user.id
    ).order_by(Registration.created_at.desc()).all()

    registrations = []
    for reg in my_regs:
        drive = db.query(Drive).filter(Drive.id == reg.drive_id).first()
        eligibility = db.query(Eligibility).filter(
            Eligibility.registration_id == reg.id
        ).first()
        result = db.query(AssessmentResult).filter(
            AssessmentResult.registration_id == reg.id
        ).first()
        voucher = db.query(Voucher).filter(
            Voucher.registration_id == reg.id
        ).first()

        # Days until voucher expiry
        days_to_expiry = None
        if voucher and voucher.expiry_date and voucher.status == "issued":
            delta = voucher.expiry_date - datetime.utcnow()
            days_to_expiry = max(0, delta.days)

        registrations.append({
            "registration_id": reg.id,
            "drive_name": drive.name if drive else "Unknown",
            "exam_track": reg.exam_track,
            "slot_datetime": reg.slot_datetime,
            "status": reg.status,
            "created_at": reg.created_at,
            "eligibility": {
                "decision": eligibility.decision if eligibility else None,
                "ai_score": eligibility.ai_score if eligibility else None,
                "ai_reasons": eligibility.ai_reasons if eligibility else None,
            } if eligibility else None,
            "result": {
                "score": result.score if result else None,
                "outcome": result.outcome if result else None,
                "exam_date": result.exam_date if result else None,
            } if result else None,
            "voucher": {
                "status": voucher.status if voucher else None,
                "vendor": voucher.vendor if voucher else None,
                "masked_code": voucher.masked_code if voucher else None,
                "expiry_date": voucher.expiry_date if voucher else None,
                "tokenized_link": voucher.tokenized_link if voucher else None,
                "days_to_expiry": days_to_expiry,
            } if voucher else None,
        })

    # Active drives available to register
    already_registered_drive_ids = [r.drive_id for r in my_regs]
    available_drives = db.query(Drive).filter(
        Drive.status == "active",
        ~Drive.id.in_(already_registered_drive_ids)
    ).all()

    return {
        "candidate_name": current_user.name,
        "registrations": registrations,
        "total_registrations": len(registrations),
        "available_drives": [
            {"id": d.id, "name": d.name, "end_date": d.end_date}
            for d in available_drives
        ],
    }

# ── Shared chart data (used by admin + coordinator) ──────────────────

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    stats = _base_stats(db)
    return stats

@router.get("/drive-funnel")
def get_drive_funnel(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    total = db.query(Registration).count()
    eligible = db.query(Eligibility).filter(Eligibility.decision == "eligible").count()
    passed = db.query(AssessmentResult).filter(AssessmentResult.outcome == "pass").count()
    vouchers = db.query(Voucher).filter(Voucher.status.in_(["issued", "redeemed"])).count()
    redeemed = db.query(Voucher).filter(Voucher.status == "redeemed").count()
    return [
        {"stage": "Registered", "count": total},
        {"stage": "Eligible", "count": eligible},
        {"stage": "Passed", "count": passed},
        {"stage": "Voucher Issued", "count": vouchers},
        {"stage": "Redeemed", "count": redeemed},
    ]

@router.get("/pass-fail")
def get_pass_fail(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    passed = db.query(AssessmentResult).filter(AssessmentResult.outcome == "pass").count()
    failed = db.query(AssessmentResult).filter(AssessmentResult.outcome == "fail").count()
    return [{"outcome": "Pass", "count": passed}, {"outcome": "Fail", "count": failed}]