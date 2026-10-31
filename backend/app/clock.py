"""Deterministic clock abstraction for time control (BLUEPRINT §6.12, NFR-6)."""
from datetime import datetime, timezone, timedelta
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime:
        """Returns the current UTC-aware datetime."""
        ...


class SystemClock(Clock):
    def now(self) -> datetime:
        return datetime.now(timezone.utc)


class FakeClock(Clock):
    def __init__(self, start_time: datetime | None = None):
        self._current = start_time or datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    def now(self) -> datetime:
        return self._current

    def advance(self, seconds: float) -> None:
        self._current += timedelta(seconds=seconds)

    def set(self, new_time: datetime) -> None:
        if new_time.tzinfo is None:
            new_time = new_time.replace(tzinfo=timezone.utc)
        self._current = new_time


class OffsetClock(Clock):
    """Clock with an adjustable offset for demo walkthroughs without waiting (DEMO_MODE)."""
    def __init__(self):
        self._offset_seconds: float = 0.0

    def now(self) -> datetime:
        base = datetime.now(timezone.utc)
        return base + timedelta(seconds=self._offset_seconds)

    def advance(self, seconds: float) -> None:
        self._offset_seconds += seconds

    def get_offset(self) -> float:
        return self._offset_seconds
