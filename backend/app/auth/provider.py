"""Identity Provider interface and abstraction (BLUEPRINT §7)."""
from dataclasses import dataclass
from typing import Protocol, Any


@dataclass(frozen=True)
class Identity:
    sub: str
    display_name: str
    email: str | None
    email_verified: bool
    claims: dict[str, Any]


@dataclass(frozen=True)
class LoginTransaction:
    state: str
    nonce: str
    authorization_url: str
    code_verifier: str


class IdentityProvider(Protocol):
    async def begin_login(self, redirect_uri: str) -> LoginTransaction:
        """Creates PKCE transaction and returns authorization URL."""
        ...

    async def complete_login(
        self,
        code: str,
        state: str,
        stored_nonce: str,
        stored_code_verifier: str,
        redirect_uri: str,
    ) -> Identity:
        """Exchanges code for tokens, validates ID token and UserInfo, returns verified Identity."""
        ...

    async def get_logout_url(self, post_logout_redirect_uri: str) -> str:
        """Returns the IdP end-session URL."""
        ...

    async def revoke_tokens(self, token: str) -> None:
        """Revokes refresh/access token at IdP if applicable."""
        ...
