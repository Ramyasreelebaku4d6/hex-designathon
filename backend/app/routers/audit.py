from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import AuditLog
from app.auth import require_role
from app.schemas import NLQueryRequest, NLQueryResponse
from app.services.openai_service import nl_to_sql_query
from app.schemas import EmailDraftRequest, EmailDraftResponse
from app.services.openai_service import draft_email
from app.models import Registration, User

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