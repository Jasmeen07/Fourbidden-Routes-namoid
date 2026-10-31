"""Seed demo users, roles, and mock resources (BLUEPRINT §5.4, §6.5, §7.2, §13)."""
import os
import sys
from datetime import datetime, timezone
import yaml

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.engine import init_database, SessionLocal
from app.db.models import User, UserRole, Resource
from app.services.audit import AuditService


def seed_demo():
    print("Initializing database and triggers...")
    init_database()
    db = SessionLocal()
    now = datetime.now(timezone.utc)

    # 1. Seed Users (Pass 1: insert users without manager_sub to satisfy FK constraints)
    users_seed_file = os.path.join("config", "users.seed.yaml")
    with open(users_seed_file, "r", encoding="utf-8") as fp:
        users_data = yaml.safe_load(fp).get("users", [])

    for u_data in users_data:
        existing_user = db.get(User, u_data["sub"])
        if not existing_user:
            user = User(
                sub=u_data["sub"],
                display_name=u_data["display_name"],
                email=u_data.get("email"),
                manager_sub=None,  # Set in pass 2
                active=u_data.get("active", True),
            )
            db.add(user)
    db.flush()

    # Pass 2: update manager_sub and roles
    for u_data in users_data:
        user = db.get(User, u_data["sub"])
        if user and u_data.get("manager_sub"):
            user.manager_sub = u_data["manager_sub"]

        for role in u_data.get("roles", []):
            existing_role = db.get(UserRole, (u_data["sub"], role))
            if not existing_role:
                db.add(UserRole(sub=u_data["sub"], role=role))
    db.flush()

    # 2. Seed Mock Resources
    res_seed_file = os.path.join("config", "resources.seed.yaml")
    with open(res_seed_file, "r", encoding="utf-8") as fp:
        resources_data = yaml.safe_load(fp).get("resources", [])

    for r_data in resources_data:
        existing_res = db.get(Resource, r_data["id"])
        if not existing_res:
            res = Resource(
                id=r_data["id"],
                name=r_data["name"],
                kind=r_data["kind"],
                tier=r_data["tier"],
                owner_sub=r_data["owner_sub"],
                allowed_actions=r_data["allowed_actions"],
                active=r_data.get("active", True),
            )
            db.add(res)

    db.commit()

    # 3. Initial audit event
    AuditService.append_event(
        session=db,
        event_type="POLICY_LOADED",
        subject_type="system",
        subject_id="seed",
        payload={"message": "Demo users, roles, and mock resources successfully seeded"},
        now=now,
    )
    db.commit()
    db.close()
    print("Database seeding completed successfully!")


if __name__ == "__main__":
    seed_demo()
