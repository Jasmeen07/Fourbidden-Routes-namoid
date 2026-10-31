"""Domain exception classes with stable error codes."""

class DomainError(Exception):
    """Base domain error with an associated stable error code and status."""
    code: str = "INTERNAL_DOMAIN_ERROR"
    status_code: int = 400

    def __init__(self, message: str, code: str | None = None, status_code: int | None = None, details: dict | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.details = details or {}


class SodSelfReviewError(DomainError):
    code = "SOD_SELF_REVIEW"
    status_code = 403


class SodDualSlotError(DomainError):
    code = "SOD_DUAL_SLOT"
    status_code = 403


class NotAssignedError(DomainError):
    code = "NOT_ASSIGNED"
    status_code = 403


class BlockedNoEligibleReviewerError(DomainError):
    code = "BLOCKED_NO_ELIGIBLE_REVIEWER"
    status_code = 409


class NarrowNotSubsetError(DomainError):
    code = "NARROW_NOT_SUBSET"
    status_code = 422


class NarrowNoopError(DomainError):
    code = "NARROW_NOOP"
    status_code = 422


class NarrowEmptyError(DomainError):
    code = "NARROW_EMPTY"
    status_code = 422


class NarrowingConflictEmptyError(DomainError):
    code = "NARROWING_CONFLICT_EMPTY"
    status_code = 422


class RequestNotOpenError(DomainError):
    code = "REQUEST_NOT_OPEN"
    status_code = 409


class StaleRequestError(DomainError):
    code = "STALE_REQUEST"
    status_code = 409


class DecisionConflictError(DomainError):
    code = "DECISION_CONFLICT"
    status_code = 409


class DuplicateRequestError(DomainError):
    code = "DUPLICATE_REQUEST"
    status_code = 409


class GrantAlreadyActiveError(DomainError):
    code = "GRANT_ALREADY_ACTIVE"
    status_code = 409


class NotAuthorizedToRevokeError(DomainError):
    code = "NOT_AUTHORIZED_TO_REVOKE"
    status_code = 403


class GrantRevokedCannotExtendError(DomainError):
    code = "GRANT_REVOKED_CANNOT_EXTEND"
    status_code = 409


class ExtensionCapExceededError(DomainError):
    code = "EXTENSION_CAP_EXCEEDED"
    status_code = 409


class ControlsMissingError(DomainError):
    code = "CONTROLS_MISSING"
    status_code = 422


class SecretPatternDetectedError(DomainError):
    code = "SECRET_PATTERN_DETECTED"
    status_code = 422


class InvalidStateTransitionError(DomainError):
    code = "INVALID_STATE_TRANSITION"
    status_code = 409
