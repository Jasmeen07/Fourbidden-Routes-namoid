"""Role resolution and first-login seed bootstrap per BLUEPRINT §7.2 (EC-A01, EC-A10)."""
import os
import yaml
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.models import User, UserRole
from app.auth.provider import Identity


class RoleResolver:
    @staticmethod
    def load_seed_users() -> list[dict]:
        seed_path = os.path.join("config", "users.seed.yaml")
        if not os.path.exists(seed_path):
            return []
        with open(seed_path, "r", encoding="utf-8") as fp:
            data = yaml.safe_load(fp)
            return data.get("users", [])

    @classmethod
    def resolve_roles(cls, session: Session, identity: Identity) -> list[str]:
        """
        Resolves roles for a signed-in subject:
        1. If identity claims provide roles, use them.
        2. Else check existing user_roles in database.
        3. On first login, if email is VERIFIED, match against users.seed.yaml.
        4. If email is unverified, DO NOT bootstrap seed roles (EC-A10).
        """
        # 1. From claims
        claim_roles = identity.claims.get("roles")
        if claim_roles and isinstance(claim_roles, list):
            return [str(r) for r in claim_roles]

        # 2. Check existing user in DB
        db_user = session.get(User, identity.sub)
        if db_user:
            roles = session.execute(
                select(UserRole.role).where(UserRole.sub == identity.sub)
            ).scalars().all()
            if roles:
                return list(roles)

        # 3. First login: match against seed file ONLY if email is verified
        if identity.email and identity.email_verified:
            seed_users = cls.load_seed_users()
            for seed in seed_users:
                if seed.get("email") and seed["email"].lower() == identity.email.lower():
                    # Bootstrap user and roles
                    roles = seed.get("roles", [])
                    return list(roles)

        return []

    @classmethod
    def upsert_user_and_roles(cls, session: Session, identity: Identity) -> User:
        """Upserts the user and their assigned roles in DB."""
        user = session.get(User, identity.sub)
        roles = cls.resolve_roles(session, identity)

        if not user:
            # Check manager from seed if bootstrapping
            manager_sub = None
            if identity.email and identity.email_verified:
                for seed in cls.load_seed_users():
                    if seed.get("email", "").lower() == identity.email.lower():
                        manager_sub = seed.get("manager_sub")
                        break

            user = User(
                sub=identity.sub,
                display_name=identity.display_name,
                email=identity.email,
                manager_sub=manager_sub,
                active=True,
            )
            session.add(user)
            session.flush()

        # Update display name / email if changed
        user.display_name = identity.display_name
        user.email = identity.email

        # Sync user_roles
        existing_roles = set(
            session.execute(select(UserRole.role).where(UserRole.sub == identity.sub)).scalars().all()
        )
        target_roles = set(roles)

        for r in target_roles - existing_roles:
            session.add(UserRole(sub=identity.sub, role=r))

        session.flush()
        return user
