"""Pytest configuration and shared test fixtures."""
import pytest
from datetime import datetime, timezone


class FakeClock:
    def __init__(self, start_time: datetime | None = None):
        self._current = start_time or datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    def now(self) -> datetime:
        return self._current

    def advance(self, seconds: float) -> None:
        from datetime import timedelta
        self._current += timedelta(seconds=seconds)

    def set(self, new_time: datetime) -> None:
        self._current = new_time


@pytest.fixture
def clock():
    return FakeClock()
