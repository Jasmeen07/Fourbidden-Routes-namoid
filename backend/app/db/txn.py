"""Transaction helpers for immediate write locks and atomic operations."""
from contextlib import contextmanager
from typing import Generator
from sqlalchemy.orm import Session
from app.db.engine import SessionLocal


@contextmanager
def write_txn(existing_session: Session | None = None) -> Generator[Session, None, None]:
    """
    Context manager that acquires an immediate write lock (BEGIN IMMEDIATE in SQLite)
    to prevent concurrency races per BLUEPRINT §6.11.
    All write operations and corresponding audit events must execute within this block.
    """
    session = existing_session or SessionLocal()
    should_close = existing_session is None

    try:
        # SQLite BEGIN IMMEDIATE write lock
        if str(session.bind.url).startswith("sqlite"):
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        if should_close:
            session.close()
