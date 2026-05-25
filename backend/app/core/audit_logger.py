from sqlalchemy.orm import Session
from datetime import datetime
import json

def write_audit_log(
    db: Session,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_id: str,
    before: dict = None,
    after: dict = None,
    ip_address: str = None
):
    from app.models import AuditLog
    log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        timestamp=datetime.utcnow(),
        before_json=json.dumps(before) if before else None,
        after_json=json.dumps(after) if after else None,
        ip_address=ip_address
    )
    db.add(log)
    db.commit()