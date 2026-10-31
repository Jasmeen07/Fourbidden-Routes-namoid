"""Real NamoID Hosted Auth provider using official namoid Python SDK (BLUEPRINT §2.1, §7.1)."""
import os
from typing import Any
from app.auth.provider import Identity, LoginTransaction, IdentityProvider
from app.domain.errors import DomainError

try:
    import namoid
    from namoid import AsyncNamoIDClient
except ImportError:
    AsyncNamoIDClient = None  # type: ignore


class NamoIDProvider(IdentityProvider):
    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        env: str = "test",
    ):
        self.client_id = client_id or os.environ.get("NAMOID_CLIENT_ID", "")
        self.client_secret = client_secret or os.environ.get("NAMOID_CLIENT_SECRET", "")
        self.env = env or os.environ.get("NAMOID_ENV", "test")

        if AsyncNamoIDClient is not None and self.client_id:
            self.client = AsyncNamoIDClient(
                client_id=self.client_id,
                client_secret=self.client_secret,
                environment=self.env,
            )
        else:
            self.client = None

    async def begin_login(self, redirect_uri: str) -> LoginTransaction:
        if self.client is None:
            raise DomainError("NamoID client not configured", code="AUTH_FAILURE", status_code=500)

        tx = await self.client.create_oidc_transaction(redirect_uri=redirect_uri)
        auth_url = self.client.authorization_url(tx)

        return LoginTransaction(
            state=tx.state,
            nonce=tx.nonce,
            authorization_url=auth_url,
            code_verifier=tx.code_verifier,
        )

    async def complete_login(
        self,
        code: str,
        state: str,
        stored_nonce: str,
        stored_code_verifier: str,
        redirect_uri: str,
    ) -> Identity:
        if self.client is None:
            raise DomainError("NamoID client not configured", code="AUTH_FAILURE", status_code=500)

        try:
            tokens = await self.client.exchange_code(
                code=code,
                code_verifier=stored_code_verifier,
                redirect_uri=redirect_uri,
            )
            id_claims = await self.client.validate_id_token(
                id_token=tokens.id_token,
                expected_nonce=stored_nonce,
            )
            userinfo = await self.client.user_info(access_token=tokens.access_token)

            # Assert sub match
            if id_claims.get("sub") != userinfo.get("sub"):
                raise DomainError("ID token subject does not match UserInfo subject", code="AUTH_TOKEN_INVALID")

            return Identity(
                sub=id_claims["sub"],
                display_name=userinfo.get("name") or id_claims.get("name", "User"),
                email=userinfo.get("email") or id_claims.get("email"),
                email_verified=bool(userinfo.get("email_verified") or id_claims.get("email_verified", False)),
                claims={**id_claims, **userinfo},
            )
        except Exception as e:
            raise DomainError(f"NamoID authentication failed: {str(e)}", code="AUTH_TOKEN_INVALID", status_code=400)

    async def get_logout_url(self, post_logout_redirect_uri: str) -> str:
        if self.client is not None and hasattr(self.client, "logout_url"):
            return self.client.logout_url(post_logout_redirect_uri=post_logout_redirect_uri)
        return "/"

    async def revoke_tokens(self, token: str) -> None:
        if self.client is not None and hasattr(self.client, "revoke_token"):
            try:
                await self.client.revoke_token(token)
            except Exception:
                pass
