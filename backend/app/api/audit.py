"""Audit trail exploration and cryptographic verification endpoints (BLUEPRINT §6.10, §8)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.services.audit import AuditService
from app.auth.deps import get_current_user, UserContext

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit_events(
    event_type: str | None = Query(None, alias="type"),
    subject_id: str | None = Query(None),
    actor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    before_seq: int | None = Query(None),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    events = AuditService.query_events(
        session=db,
        event_type=event_type,
        subject_id=subject_id,
        actor_sub=actor,
        limit=limit,
        before_seq=before_seq,
    )
    return [
        {
            "seq": e.seq,
            "id": e.id,
            "ts": e.ts.isoformat(),
            "type": e.type,
            "actor_sub": e.actor_sub,
            "actor_role": e.actor_role,
            "subject_type": e.subject_type,
            "subject_id": e.subject_id,
            "payload": e.payload,
            "prev_hash": e.prev_hash,
            "hash": e.hash,
        }
        for e in events
    ]


@router.get("/verify")
def verify_audit_chain(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Recomputes and verifies the full cryptographic hash chain (EC-L02, EC-L03)."""
    return AuditService.verify_chain(db)
