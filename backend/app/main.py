"""GrantGate FastAPI Application Factory (BLUEPRINT §5, §8, §13)."""
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.clock import OffsetClock, SystemClock
from app.domain.policy import parse_policy_yaml
from app.domain.errors import DomainError
from app.api.problems import domain_error_handler
from app.db.engine import init_database, SessionLocal
from app.services.grants import GrantsService
from app.api import auth, resources, requests, grants, sim, audit, policy, ops, hierarchy, provenance


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB and triggers
    init_database()

    # Load policy from config
    with open(settings.POLICY_PATH, "r", encoding="utf-8") as fp:
        app.state.policy = parse_policy_yaml(fp.read())

    # Clock injection (OffsetClock in demo mode, SystemClock in prod)
    if settings.DEMO_MODE:
        app.state.clock = OffsetClock()
    else:
        app.state.clock = SystemClock()

    # Background sweeper task (60s tick)
    async def sweeper_loop():
        while True:
            try:
                await asyncio.sleep(60)
                db = SessionLocal()
                try:
                    now = app.state.clock.now()
                    GrantsService.tick_sweeper(db, app.state.policy, now)
                    db.commit()
                finally:
                    db.close()
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    sweeper_task = asyncio.create_task(sweeper_loop())
    yield
    sweeper_task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(
        title="GrantGate",
        description="Secure Model & Dataset Access Governance API",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        # CSP
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        )
        return response

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Problem+JSON error handler
    app.add_exception_handler(DomainError, domain_error_handler)

    # Include routers
    app.include_router(auth.router)
    app.include_router(resources.router)
    app.include_router(requests.router)
    app.include_router(grants.router)
    app.include_router(sim.router)
    app.include_router(audit.router)
    app.include_router(policy.router)
    app.include_router(ops.router)
    app.include_router(hierarchy.router)
    app.include_router(provenance.router)

    return app


app = create_app()
