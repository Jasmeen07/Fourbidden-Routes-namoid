"""Spec-faithful Mock Identity Provider for local testing and CI (BLUEPRINT §7.2, §15.2 B4)."""
import os
import hashlib
import base64
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any
import jwt
from app.auth.provider import Identity, LoginTransaction, IdentityProvider
from app.domain.errors import DomainError

# Mock RSA/HMAC signing key for tests
MOCK_SIGNING_SECRET = "mock_idp_secret_key_for_testing_purposes_only_32_chars"
MOCK_ISSUER = "https://auth.namoid.test"
MOCK_AUDIENCE = "grantgate-client"


class MockOidcProvider(IdentityProvider):
    def __init__(self, fail_hook: str | None = None):
        env = os.environ.get("NAMOID_ENV", "test").lower()
        if env == "live":
            raise RuntimeError("MockOidcProvider is strictly forbidden when NAMOID_ENV=live")
        self.fail_hook = fail_hook
        self.mock_users = {
            "alice": {
                "sub": "usr_req_a",
                "display_name": "Alice Requester",
                "email": "alice.requester@namoid.test",
                "email_verified": True,
                "roles": ["requester"],
            },
            "bob": {
                "sub": "usr_req_b",
                "display_name": "Bob DualRole",
                "email": "bob.dual@namoid.test",
                "email_verified": True,
                "roles": ["requester", "risk_reviewer"],
            },
            "mary": {
                "sub": "usr_mgr_1",
                "display_name": "Mary Manager",
                "email": "mary.manager@namoid.test",
                "email_verified": True,
                "roles": ["manager"],
            },
            "rachel": {
                "sub": "usr_risk_1",
                "display_name": "Rachel RiskReviewer",
                "email": "rachel.risk@namoid.test",
                "email_verified": True,
                "roles": ["risk_reviewer"],
            },
            "oscar": {
                "sub": "usr_owner_1",
                "display_name": "Oscar ResourceOwner",
                "email": "oscar.owner@namoid.test",
                "email_verified": True,
                "roles": ["resource_owner"],
            },
            "noroles": {
                "sub": "usr_no_roles",
                "display_name": "No Role User",
                "email": "noroles@namoid.test",
                "email_verified": True,
                "roles": [],
            },
            "unverified": {
                "sub": "usr_unverified",
                "display_name": "Unverified User",
                "email": "alice.requester@namoid.test",  # Tries to claim Alice's email
                "email_verified": False,
                "roles": [],
            },
        }

    async def begin_login(self, redirect_uri: str, mock_user_key: str = "alice") -> LoginTransaction:
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(32)

        # S256 code challenge
        h = hashlib.sha256(verifier.encode("ascii")).digest()
        challenge = base64.urlsafe_b64encode(h).decode("ascii").rstrip("=")

        auth_url = f"{MOCK_ISSUER}/auth?response_type=code&client_id={MOCK_AUDIENCE}&redirect_uri={redirect_uri}&state={state}&nonce={nonce}&code_challenge={challenge}&code_challenge_method=S256&user={mock_user_key}"

        return LoginTransaction(
            state=state,
            nonce=nonce,
            authorization_url=auth_url,
            code_verifier=verifier,
        )

    async def complete_login(
        self,
        code: str,
        state: str,
        stored_nonce: str,
        stored_code_verifier: str,
        redirect_uri: str,
    ) -> Identity:
        # Check tampering test hooks (EC-A03)
        user_key = code if code in self.mock_users else "alice"
        user_data = self.mock_users.get(user_key, self.mock_users["alice"])

        now = datetime.now(timezone.utc)
        exp = now + timedelta(minutes=10)
        nbf = now - timedelta(seconds=10)
        iss = MOCK_ISSUER
        aud = MOCK_AUDIENCE
        token_nonce = stored_nonce

        if self.fail_hook == "bad_signature":
            secret = "wrong_secret"
        else:
            secret = MOCK_SIGNING_SECRET

        if self.fail_hook == "expired_token":
            exp = now - timedelta(minutes=5)
            nbf = now - timedelta(minutes=15)

        if self.fail_hook == "wrong_aud":
            aud = "foreign-client-app"

        if self.fail_hook == "wrong_iss":
            iss = "https://evil.idp.test"

        if self.fail_hook == "nonce_mismatch":
            token_nonce = "tampered_nonce"

        claims = {
            "iss": iss,
            "aud": aud,
            "sub": user_data["sub"],
            "nonce": token_nonce,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
            "nbf": int(nbf.timestamp()),
            "name": user_data["display_name"],
            "email": user_data["email"],
            "email_verified": user_data["email_verified"],
            "roles": user_data.get("roles", []),
        }

        token = jwt.encode(claims, secret, algorithm="HS256")

        # Validate token against expected params
        try:
            validated = jwt.decode(
                token,
                MOCK_SIGNING_SECRET,
                algorithms=["HS256"],
                audience=MOCK_AUDIENCE,
                issuer=MOCK_ISSUER,
            )
        except jwt.PyJWTError as e:
            raise DomainError(f"ID token validation failed: {str(e)}", code="AUTH_TOKEN_INVALID", status_code=400)

        if validated.get("nonce") != stored_nonce:
            raise DomainError("ID token nonce mismatch", code="AUTH_TOKEN_INVALID", status_code=400)

        return Identity(
            sub=validated["sub"],
            display_name=validated["name"],
            email=validated.get("email"),
            email_verified=bool(validated.get("email_verified", False)),
            claims=validated,
        )

    async def get_logout_url(self, post_logout_redirect_uri: str) -> str:
        return f"{MOCK_ISSUER}/logout?post_logout_redirect_uri={post_logout_redirect_uri}"

    async def revoke_tokens(self, token: str) -> None:
        pass
