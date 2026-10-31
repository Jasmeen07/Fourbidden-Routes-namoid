"""Simulation Gateway invocation API (BLUEPRINT §6.6, §8)."""
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.auth.deps import get_current_user, UserContext
from app.services.gateway import SimulationGateway

router = APIRouter(prefix="/api/sim", tags=["simulation"])


class InvokePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str
    declared_purpose: str
    input: Any = None


@router.post("/resources/{resource_id}/invoke")
def invoke_resource(
    resource_id: str,
    payload: InvokePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    result = SimulationGateway.invoke(
        db=db,
        resource_id=resource_id,
        action=payload.action,
        declared_purpose=payload.declared_purpose,
        caller_sub=user.sub,
        input_data=payload.input,
        now=now,
    )
    db.commit()
    return result
