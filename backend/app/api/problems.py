"""RFC 9457 problem+json error formatting."""
from fastapi import Request
from fastapi.responses import JSONResponse
from app.domain.errors import DomainError


def problem_response(
    status_code: int,
    code: str,
    title: str,
    detail: str,
    details: dict | None = None,
) -> JSONResponse:
    content = {
        "type": f"https://grantgate.io/errors/{code.lower()}",
        "title": title,
        "status": status_code,
        "code": code,
        "detail": detail,
    }
    if details:
        content["details"] = details

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers={"Content-Type": "application/problem+json"},
    )


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return problem_response(
        status_code=exc.status_code,
        code=exc.code,
        title=exc.code.replace("_", " ").title(),
        detail=exc.message,
        details=exc.details,
    )
