"""Catalog of mock resources (BLUEPRINT §6.5, §8)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.engine import get_db
from app.db.models import Resource
from app.auth.deps import get_current_user, UserContext

router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("")
def list_resources(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    resources = db.execute(select(Resource).where(Resource.active.is_(True))).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "kind": r.kind,
            "tier": r.tier,
            "owner_sub": r.owner_sub,
            "allowed_actions": r.allowed_actions,
            "active": r.active,
        }
        for r in resources
    ]


@router.get("/{resource_id}")
def get_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    r = db.get(Resource, resource_id)
    if not r or not r.active:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {
        "id": r.id,
        "name": r.name,
        "kind": r.kind,
        "tier": r.tier,
        "owner_sub": r.owner_sub,
        "allowed_actions": r.allowed_actions,
        "active": r.active,
    }
