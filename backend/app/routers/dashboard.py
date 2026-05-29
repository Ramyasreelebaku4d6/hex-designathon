from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, exists
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    Drive, Registration, Eligibility,
    AssessmentResult, Voucher, User,
    AuditLog, DriveCertification, Certification
)
from app.auth import get_current_user, require_role

router = APIRouter()

# ── Shared helpers ───────────────────────────────────────────────────

def _base_stats(db):
    # 3 GROUP BY queries instead of 9 scalar queries
    v  = dict(db.query(Voucher.status,           func.count(Voucher.id))          .group_by(Voucher.status).all())
    ar = dict(db.query(AssessmentResult.outcome,  func.count(AssessmentResult.id)) .group_by(AssessmentResult.outcome).all())
    eg = dict(db.query(Eligibility.decision,      func.count(Eligibility.id))      .group_by(Eligibility.decision).all())
    return {
        "total_drives":          db.query(Drive).count(),
        "active_drives":         db.query(Drive).filter(Drive.status == "active").count(),
        "total_registrations":   db.query(Registration).count(),
        "eligible_count":        eg.get("eligible", 0),
        "ineligible_count":      eg.get("ineligible", 0),
        "passed_count":          ar.get("pass", 0),
        "failed_count":          ar.get("fail", 0),
        "vouchers_issued":       v.get("issued", 0),
        "vouchers_redeemed":     v.get("redeemed", 0),
        "vouchers_unassigned":   v.get("unassigned", 0),
    }

# ── Admin dashboard ──────────────────────────────────────────────────

@router.get("/admin")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    stats = _base_stats(db)

    budget_total = db.query(func.sum(Drive.budget)).filter(
        Drive.status.in_(["active", "closed"])
    ).scalar() or 0

    passed = stats["passed_count"]
    roi = round(budget_total / passed, 2) if passed > 0 else 0

    total_reg = stats["total_registrations"]
    ack_sent = db.query(Registration).filter(
        Registration.ack_email_sent_at != None
    ).count()
    sla_pct = round((ack_sent / total_reg * 100), 1) if total_reg > 0 else 0

    return {
        **stats,
        "budget_total": budget_total,
        "roi_cost_per_certified": roi,
        "sla_compliance_pct": sla_pct,
        # ineligible_count already in stats from _base_stats
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

    pending_eval = db.query(Registration).filter(
        Registration.status == "registered"
    ).count()

    reg_this_week = db.query(Registration).filter(
        Registration.created_at >= week_ago
    ).count()

    reg_last_week = db.query(Registration).filter(
        Registration.created_at >= last_week_start,
        Registration.created_at < week_ago
    ).count()

    expiring_soon = db.query(Voucher).filter(
        Voucher.status == "issued",
        Voucher.expiry_date <= now + timedelta(days=7),
        Voucher.expiry_date >= now
    ).count()

    pending_approval = db.query(Eligibility).filter(
        Eligibility.decision == "pending_approval"
    ).count()

    # Recent registrations — single JOIN instead of 5×2 per-row queries
    recent_rows = (
        db.query(Registration, User, Drive)
        .join(User, Registration.user_id == User.id)
        .join(Drive, Registration.drive_id == Drive.id)
        .order_by(Registration.created_at.desc())
        .limit(5)
        .all()
    )
    recent_list = [
        {
            "id": r.id,
            "candidate_name": u.name,
            "drive_name": d.name,
            "exam_track": r.exam_track,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r, u, d in recent_rows
    ]

    # Unallocated vouchers — single EXISTS subquery instead of N per-row queries
    unallocated = (
        db.query(AssessmentResult)
        .filter(
            AssessmentResult.outcome == "pass",
            ~exists().where(Voucher.registration_id == AssessmentResult.registration_id)
        )
        .count()
    )

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

    # Pending queue — single JOIN instead of N×3 per-row queries
    pending_rows = (
        db.query(Eligibility, Registration, User, Drive)
        .join(Registration, Eligibility.registration_id == Registration.id)
        .join(User, Registration.user_id == User.id)
        .join(Drive, Registration.drive_id == Drive.id)
        .filter(Eligibility.decision == "pending_approval")
        .all()
    )
    queue = [
        {
            "eligibility_id": e.id,
            "registration_id": e.registration_id,
            "candidate_name": u.name,
            "candidate_email": u.email,
            "business_unit": u.business_unit or "",
            "exam_track": r.exam_track or "",
            "drive_name": d.name,
            "ai_score": e.ai_score,
            "ai_reasons": e.ai_reasons,
            "created_at": r.created_at,
        }
        for e, r, u, d in pending_rows
    ]

    # Both approval counts in one GROUP BY query
    decision_counts = dict(
        db.query(Eligibility.decision, func.count(Eligibility.id))
        .filter(Eligibility.decision.in_(["eligible", "ineligible"]),
                Eligibility.decision_date >= month_ago)
        .group_by(Eligibility.decision)
        .all()
    )

    return {
        "pending_queue": queue,
        "pending_count": len(queue),
        "approved_this_month": decision_counts.get("eligible", 0),
        "rejected_this_month": decision_counts.get("ineligible", 0),
    }

# ── Candidate dashboard ──────────────────────────────────────────────

@router.get("/candidate")
def candidate_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from app.models import ExamSession, UserCertificate

    my_regs = (
        db.query(Registration)
        .filter(Registration.user_id == current_user.id)
        .order_by(Registration.created_at.desc())
        .all()
    )

    if not my_regs:
        available_drives = db.query(Drive).filter(Drive.status == "active").all()
        return {
            "candidate_name": current_user.name,
            "registrations": [],
            "total_registrations": 0,
            "available_drives": [
                {"id": d.id, "name": d.name, "end_date": d.end_date}
                for d in available_drives
            ],
        }

    reg_ids  = [r.id       for r in my_regs]
    drive_ids = list({r.drive_id for r in my_regs})

    # Bulk load all related data — 6 IN queries instead of N×6 per-row queries
    drives_map = {
        d.id: d for d in db.query(Drive).filter(Drive.id.in_(drive_ids)).all()
    }
    eligs_map = {
        e.registration_id: e
        for e in db.query(Eligibility).filter(Eligibility.registration_id.in_(reg_ids)).all()
    }
    results_map = {
        r.registration_id: r
        for r in db.query(AssessmentResult).filter(AssessmentResult.registration_id.in_(reg_ids)).all()
    }
    vouchers_map = {
        v.registration_id: v
        for v in db.query(Voucher).filter(Voucher.registration_id.in_(reg_ids)).all()
    }
    sessions_map = {
        s.registration_id: s
        for s in db.query(ExamSession).filter(ExamSession.registration_id.in_(reg_ids)).all()
    }
    certs_map = {
        c.registration_id: c
        for c in db.query(UserCertificate).filter(UserCertificate.registration_id.in_(reg_ids)).all()
    }

    now = datetime.utcnow()
    registrations = []
    for reg in my_regs:
        drive       = drives_map.get(reg.drive_id)
        eligibility = eligs_map.get(reg.id)
        result      = results_map.get(reg.id)
        voucher     = vouchers_map.get(reg.id)
        exam_session = sessions_map.get(reg.id)
        certificate = certs_map.get(reg.id)

        days_to_expiry = None
        if voucher and voucher.expiry_date and voucher.status == "issued":
            days_to_expiry = max(0, (voucher.expiry_date - now).days)

        slot_info = None
        if reg.slot_datetime:
            diff_days = (reg.slot_datetime - now).total_seconds() / 86400
            slot_info = {
                "datetime": reg.slot_datetime,
                "diff_days": round(diff_days, 2),
                "is_past": diff_days < 0,
            }

        registrations.append({
            "registration_id":  reg.id,
            "drive_name":       drive.name if drive else "Unknown",
            "drive_id":         reg.drive_id,
            "exam_track":       reg.exam_track,
            "cert_id":          reg.cert_id,
            "custom_cert_name": reg.custom_cert_name,
            "is_custom_cert":   reg.is_custom_cert,
            "slot_datetime":    reg.slot_datetime,
            "slot_info":        slot_info,
            "status":           reg.status,
            "course_completed": reg.course_completed,
            "prior_attempts":   reg.prior_attempts,
            "created_at":       reg.created_at,
            "eligibility": {
                "id":       eligibility.id,
                "decision": eligibility.decision,
                "ai_score": eligibility.ai_score,
                "ai_reasons": eligibility.ai_reasons,
            } if eligibility else None,
            "result": {
                "score":    result.score,
                "outcome":  result.outcome,
                "exam_date": result.exam_date,
            } if result else None,
            "voucher": {
                "id":             voucher.id,
                "status":         voucher.status,
                "vendor":         voucher.vendor,
                "masked_code":    voucher.masked_code,
                "expiry_date":    voucher.expiry_date,
                "tokenized_link": voucher.tokenized_link,
                "days_to_expiry": days_to_expiry,
            } if voucher else None,
            "exam_session": {
                "id":           exam_session.id,
                "status":       exam_session.status,
                "started_at":   exam_session.started_at,
                "submitted_at": exam_session.submitted_at,
            } if exam_session else None,
            "certificate": {
                "id":            certificate.id,
                "cert_name":     certificate.cert_name,
                "issued_date":   certificate.issued_date,
                "expiry_date":   certificate.expiry_date,
                "status":        certificate.status,
                "days_remaining": max(0, (certificate.expiry_date - now).days),
            } if certificate else None,
        })

    available_drives = db.query(Drive).filter(
        Drive.status == "active",
        ~Drive.id.in_(drive_ids)
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
    return _base_stats(db)

@router.get("/drive-funnel")
def get_drive_funnel(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    total    = db.query(Registration).count()
    eligible = db.query(Eligibility).filter(Eligibility.decision == "eligible").count()
    passed   = db.query(AssessmentResult).filter(AssessmentResult.outcome == "pass").count()

    # Both voucher counts from one GROUP BY
    v = dict(
        db.query(Voucher.status, func.count(Voucher.id))
        .filter(Voucher.status.in_(["issued", "redeemed"]))
        .group_by(Voucher.status)
        .all()
    )
    issued_or_redeemed = v.get("issued", 0) + v.get("redeemed", 0)
    redeemed = v.get("redeemed", 0)

    return [
        {"stage": "Registered",    "count": total},
        {"stage": "Eligible",      "count": eligible},
        {"stage": "Passed",        "count": passed},
        {"stage": "Voucher Issued","count": issued_or_redeemed},
        {"stage": "Redeemed",      "count": redeemed},
    ]

@router.get("/pass-fail")
def get_pass_fail(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # One GROUP BY instead of two separate COUNTs
    counts = dict(
        db.query(AssessmentResult.outcome, func.count(AssessmentResult.id))
        .group_by(AssessmentResult.outcome)
        .all()
    )
    return [
        {"outcome": "Pass", "count": counts.get("pass", 0)},
        {"outcome": "Fail", "count": counts.get("fail", 0)},
    ]

@router.get("/voucher-stats")
def get_voucher_stats(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    from app.models import Certification

    drives = db.query(Drive).all()
    if not drives:
        return []

    # All drive-cert rows joined with certification names
    dc_rows = (
        db.query(DriveCertification, Certification)
        .join(Certification, DriveCertification.cert_id == Certification.id)
        .all()
    )
    dc_by_drive: dict = {}
    for dc, cert in dc_rows:
        dc_by_drive.setdefault(dc.drive_id, []).append((dc, cert))

    # All voucher counts in one GROUP BY
    count_rows = (
        db.query(
            Voucher.drive_id,
            Voucher.cert_id,
            Voucher.status,
            func.count(Voucher.id).label("cnt"),
        )
        .group_by(Voucher.drive_id, Voucher.cert_id, Voucher.status)
        .all()
    )
    vc: dict = {(r.drive_id, r.cert_id, r.status): r.cnt for r in count_rows}

    result = []
    for drive in drives:
        cert_stats = []
        drive_total = {"unassigned": 0, "issued": 0, "redeemed": 0, "expired": 0}
        all_exhausted = True

        for dc, cert in dc_by_drive.get(drive.id, []):
            unassigned = vc.get((drive.id, cert.id, "unassigned"), 0)
            issued     = vc.get((drive.id, cert.id, "issued"),     0)
            redeemed   = vc.get((drive.id, cert.id, "redeemed"),   0)
            expired    = vc.get((drive.id, cert.id, "expired"),    0)
            total      = unassigned + issued + redeemed + expired

            if unassigned > 0:
                all_exhausted = False

            cert_stats.append({
                "cert_id":        cert.id,
                "cert_name":      cert.name,
                "unassigned":     unassigned,
                "issued":         issued,
                "redeemed":       redeemed,
                "expired":        expired,
                "total":          total,
                "utilization_pct": round((redeemed / total * 100) if total > 0 else 0, 1),
                "is_exhausted":   unassigned == 0,
            })

            drive_total["unassigned"] += unassigned
            drive_total["issued"]     += issued
            drive_total["redeemed"]   += redeemed
            drive_total["expired"]    += expired

        total_drive = sum(drive_total.values())
        result.append({
            "drive_id":            drive.id,
            "drive_name":          drive.name,
            "drive_status":        drive.status,
            "budget":              drive.budget,
            "start_date":          drive.start_date,
            "end_date":            drive.end_date,
            "certifications":      cert_stats,
            "totals":              drive_total,
            "total_vouchers":      total_drive,
            "utilization_pct":     round(
                (drive_total["redeemed"] / total_drive * 100) if total_drive > 0 else 0, 1
            ),
            "all_certs_exhausted": all_exhausted,
            "can_add_vouchers":    drive.status == "active",
        })

    return result
