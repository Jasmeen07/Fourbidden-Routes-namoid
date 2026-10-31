"""Operations, health checks, time synchronization, and demo clock controls (BLUEPRINT §8, §15.2 B9)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.engine import get_db
from app.db.models import Notification
from app.auth.deps import get_current_user, UserContext
from app.services.audit import AuditService
from app.config import settings

router = APIRouter(tags=["ops"])


class AdvanceClockPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seconds: float


@router.get("/healthz")
def healthz():
    return {"status": "ok", "service": "grantgate", "version": "1.0.0"}


@router.get("/api/time")
def server_time(request: Request):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)
    return {"server_now": now.isoformat(), "timestamp": now.timestamp()}


@router.get("/api/notifications")
def list_notifications(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    notifs = db.execute(
        select(Notification).where(Notification.to_sub == user.sub).order_by(Notification.created_at.desc())
    ).scalars().all()
    return [
        {
            "id": n.id,
            "kind": n.kind,
            "ref_id": n.ref_id,
            "message": n.message,
            "created_at": n.created_at.isoformat(),
            "read_at": n.read_at.isoformat() if n.read_at else None,
        }
        for n in notifs
    ]


@router.post("/api/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    notif = db.get(Notification, notif_id)
    if not notif or notif.to_sub != user.sub:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read_at = now
    db.commit()
    return {"id": notif.id, "read_at": notif.read_at.isoformat()}


@router.post("/api/dev/clock/advance")
def advance_clock(
    payload: AdvanceClockPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Demo-only clock adjustment (404 when DEMO_MODE=false). Audited CLOCK_ADVANCED."""
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=404, detail="Dev clock advance disabled in non-demo mode")

    clock = getattr(request.app.state, "clock", None)
    if hasattr(clock, "advance"):
        clock.advance(payload.seconds)
    else:
        raise HTTPException(status_code=400, detail="Clock is not adjustable")

    now = clock.now()
    AuditService.append_event(
        session=db,
        event_type="CLOCK_ADVANCED",
        subject_type="system",
        subject_id="clock",
        payload={"advanced_seconds": payload.seconds, "new_server_now": now.isoformat()},
        actor_sub=user.sub,
        now=now,
    )
    db.commit()

    return {"server_now": now.isoformat(), "advanced_seconds": payload.seconds}
