from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import AuditLog, Drive, User
from app.auth import require_role, get_current_user
from app.schemas import NLQueryRequest, NLQueryResponse
from app.services.openai_service import nl_to_sql_query
from app.schemas import EmailDraftRequest, EmailDraftResponse
from app.services.openai_service import draft_email
from app.models import Registration

router = APIRouter()

@router.get("/logs")
def get_audit_logs(
    limit: int = 50,
    entity_type: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    return query.limit(limit).all()

@router.post("/query", response_model=NLQueryResponse)
async def natural_language_query(
    request: NLQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    result = await nl_to_sql_query(request.question, db)
    return result

@router.post("/draft-email", response_model=EmailDraftResponse)
async def draft_followup_email(
    request: EmailDraftRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    reg = db.query(Registration).filter(
        Registration.id == request.registration_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    user = db.query(User).filter(User.id == reg.user_id).first()
    drive = reg.drive

    result = await draft_email(
        candidate_name=user.name,
        candidate_email=user.email,
        status=reg.status,
        exam_track=reg.exam_track or "General",
        drive_name=drive.name if drive else "Certification Drive",
        reason=request.context
    )
    return result


@router.get("/drive-logs")
def get_drive_audit_logs(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "coordinator"))
):
    """
    Returns drive creation and status-change audit logs.
    Coordinator sees only drives they created; admin sees all.
    Supports optional date range filter (from_date / to_date as YYYY-MM-DD).
    """
    # Parse date range
    dt_from = datetime.strptime(from_date, "%Y-%m-%d") if from_date else None
    dt_to_raw = datetime.strptime(to_date, "%Y-%m-%d").replace(
        hour=23, minute=59, second=59
    ) if to_date else None

    # All drives in the system
    all_drives = db.query(Drive).order_by(Drive.created_at.desc()).all()

    # Get drive IDs created by this coordinator (from audit logs)
    if current_user.role == "coordinator":
        created_logs = db.query(AuditLog).filter(
            AuditLog.entity_type == "Drive",
            AuditLog.action == "created",
            AuditLog.actor_id == current_user.id
        ).all()
        coordinator_drive_ids = {log.entity_id for log in created_logs}
        drives_to_show = [d for d in all_drives if d.id in coordinator_drive_ids]
    else:
        drives_to_show = all_drives

    result = []
    for drive in drives_to_show:
        # Get creation log
        creation_log = db.query(AuditLog).filter(
            AuditLog.entity_type == "Drive",
            AuditLog.entity_id == drive.id,
            AuditLog.action == "created"
        ).first()

        creator = None
        if creation_log:
            creator = db.query(User).filter(User.id == creation_log.actor_id).first()

        # Get all status change logs for this drive
        status_logs_q = db.query(AuditLog).filter(
            AuditLog.entity_type == "Drive",
            AuditLog.entity_id == drive.id,
            AuditLog.action == "status_changed"
        ).order_by(AuditLog.timestamp.asc())

        if dt_from:
            status_logs_q = status_logs_q.filter(AuditLog.timestamp >= dt_from)
        if dt_to_raw:
            status_logs_q = status_logs_q.filter(AuditLog.timestamp <= dt_to_raw)

        status_logs = status_logs_q.all()

        # Filter creation log by date range too
        if creation_log:
            if dt_from and creation_log.timestamp < dt_from:
                if not status_logs:
                    continue
            if dt_to_raw and creation_log.timestamp > dt_to_raw:
                if not status_logs:
                    continue

        import json
        timeline = []
        for sl in status_logs:
            before_data = json.loads(sl.before_json) if sl.before_json else {}
            after_data = json.loads(sl.after_json) if sl.after_json else {}
            actor = db.query(User).filter(User.id == sl.actor_id).first()
            timeline.append({
                "from_status": before_data.get("status"),
                "to_status": after_data.get("status"),
                "changed_at": sl.timestamp,
                "changed_by": actor.name if actor else "Unknown",
            })

        result.append({
            "drive_id": drive.id,
            "drive_name": drive.name,
            "drive_status": drive.status,
            "created_at": creation_log.timestamp if creation_log else drive.created_at,
            "created_by": creator.name if creator else "Unknown",
            "start_date": drive.start_date,
            "end_date": drive.end_date,
            "status_timeline": timeline,
        })

    return result