"""Database engine configuration, WAL mode, foreign keys, and trigger setup."""
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from app.db.models import Base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./grantgate.db")

# For SQLite, ensure thread safety and explicit transactions
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 15}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Configures SQLite pragmas per BLUEPRINT §6.9, §6.11."""
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TRIGGERS_DDL = [
    # 1. Audit is strictly append-only
    """
    CREATE TRIGGER IF NOT EXISTS audit_no_update
    BEFORE UPDATE ON audit_events
    BEGIN
        SELECT RAISE(ABORT, 'audit is append-only');
    END;
    """,
    """
    CREATE TRIGGER IF NOT EXISTS audit_no_delete
    BEFORE DELETE ON audit_events
    BEGIN
        SELECT RAISE(ABORT, 'audit is append-only');
    END;
    """,
    # 2. Grant scope columns are strictly immutable
    """
    CREATE TRIGGER IF NOT EXISTS grants_scope_immutable
    BEFORE UPDATE OF requester_sub, resource_id, purpose_code, actions, activated_at, expires_at, request_id
    ON grants
    BEGIN
        SELECT RAISE(ABORT, 'grant scope is immutable');
    END;
    """,
    # 3. No grant created unless request status is APPROVED
    """
    CREATE TRIGGER IF NOT EXISTS grants_require_approved
    BEFORE INSERT ON grants
    WHEN (SELECT status FROM access_requests WHERE id = NEW.request_id) <> 'APPROVED'
    BEGIN
        SELECT RAISE(ABORT, 'request not approved');
    END;
    """,
    # 4. Terminal grant states (REVOKED, EXPIRED) cannot be altered
    """
    CREATE TRIGGER IF NOT EXISTS grants_terminal
    BEFORE UPDATE OF status ON grants
    WHEN OLD.status IN ('REVOKED', 'EXPIRED') AND NEW.status <> OLD.status
    BEGIN
        SELECT RAISE(ABORT, 'terminal grant state');
    END;
    """,
    # 5. Decided review slots are immutable
    """
    CREATE TRIGGER IF NOT EXISTS slots_decided_immutable
    BEFORE UPDATE OF decision, approved_limits, decided_by_sub, decided_at, bound_request_hash
    ON review_slots
    WHEN OLD.status IN ('APPROVED', 'NARROWED', 'REJECTED')
    BEGIN
        SELECT RAISE(ABORT, 'decided slots are immutable');
    END;
    """,
    # 6. Request content columns are immutable once submitted
    """
    CREATE TRIGGER IF NOT EXISTS requests_content_immutable
    BEFORE UPDATE OF requester_sub, resource_id, purpose_code, purpose_text, actions, duration_minutes, risk_controls, policy_version, content_hash
    ON access_requests
    BEGIN
        SELECT RAISE(ABORT, 'request content is immutable');
    END;
    """,
]


def init_database(custom_engine=None) -> None:
    """Initializes tables and DB triggers."""
    target_engine = custom_engine or engine
    Base.metadata.create_all(bind=target_engine)

    if str(target_engine.url).startswith("sqlite"):
        with target_engine.connect() as conn:
            # Safe migration for grants utilization columns
            try:
                conn.exec_driver_sql("ALTER TABLE grants ADD COLUMN last_used_at DATETIME;")
            except Exception:
                pass
            try:
                conn.exec_driver_sql("ALTER TABLE grants ADD COLUMN invocation_count INTEGER DEFAULT 0 NOT NULL;")
            except Exception:
                pass
            # Safe migrations for hierarchy and agent columns
            for col_sql in [
                "ALTER TABLE users ADD COLUMN is_agent BOOLEAN DEFAULT 0 NOT NULL;",
                "ALTER TABLE users ADD COLUMN owner_sub VARCHAR(128);",
                "ALTER TABLE users ADD COLUMN department VARCHAR(64) DEFAULT 'General' NOT NULL;",
                "ALTER TABLE users ADD COLUMN employee_id VARCHAR(64);",
                "ALTER TABLE users ADD COLUMN delegated_permissions JSON;",
                "ALTER TABLE resources ADD COLUMN department VARCHAR(64) DEFAULT 'General' NOT NULL;",
                "ALTER TABLE resources ADD COLUMN sensitivity VARCHAR(64) DEFAULT 'INTERNAL' NOT NULL;",
                "ALTER TABLE resources ADD COLUMN is_crucial BOOLEAN DEFAULT 0 NOT NULL;",
            ]:
                try:
                    conn.exec_driver_sql(col_sql)
                except Exception:
                    pass

            for ddl in TRIGGERS_DDL:
                conn.exec_driver_sql(ddl)
            conn.commit()


def get_db():
    """FastAPI dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
