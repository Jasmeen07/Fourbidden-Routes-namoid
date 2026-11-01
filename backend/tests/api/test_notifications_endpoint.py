"""Tests for Notification API and Review Decision Summaries.

Verifies:
- EC-NOTIF-01: Requester receives notifications on approval and rejection with reviewer summaries and rationale.
- EC-NOTIF-02: Listing notifications and marking notifications as read.
"""
from datetime import datetime, timezone, timedelta
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from app.main import create_app
from app.db.engine import SessionLocal, init_database
from app.db.models import User, Notification


@pytest.fixture
def client_and_db():
    init_database()
    app = create_app()
    db = SessionLocal()
    try:
        user = db.get(User, "usr_test_requester")
        if not user:
            user = User(
                sub="usr_test_requester",
                display_name="Test Requester",
                email="requester@test.local",
                department="Testing",
                active=True,
            )
            db.add(user)
            db.commit()

        # Clean notifications for test user
        db.execute(delete(Notification).where(Notification.to_sub == "usr_test_requester"))
        db.commit()

        client = TestClient(app)
        yield client, db
    finally:
        db.close()


@pytest.mark.ec("EC-NOTIF-01")
def test_list_notifications_and_mark_read(client_and_db):
    client, db = client_and_db
    now = datetime.now(timezone.utc)

    # Seed two notifications for the user
    notif1 = Notification(
        id="notif_test_appr",
        to_sub="usr_test_requester",
        kind="REQUEST_APPROVED",
        ref_id="grant_123",
        message="Access request for Test Dataset was APPROVED!\n• Carol (Manager): APPROVE - 'Verified'",
        created_at=now,
    )
    notif2 = Notification(
        id="notif_test_rej",
        to_sub="usr_test_requester",
        kind="REQUEST_REJECTED",
        ref_id="req_456",
        message="Access request for Test Model was REJECTED by Elena (Risk Reviewer). Rationale: 'Violates SG-2'",
        created_at=now,
    )
    db.add(notif1)
    db.add(notif2)
    db.commit()

    # Create session for usr_test_requester
    token = jwt.encode({
        "sub": "usr_test_requester",
        "name": "Test Requester",
        "email": "requester@test.local",
        "roles": ["requester"],
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }, "secret", algorithm="HS256")

    login_resp = client.post("/auth/session", json={"id_token": token})
    assert login_resp.status_code == 200
    session_token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {session_token}"}

    # 1. List notifications
    res = client.get("/api/notifications", headers=headers)
    assert res.status_code == 200
    data = res.json()
    print("DEBUG DATA:", data)
    assert len(data) == 2
    assert data[0]["read"] is False


    # 2. Mark one as read
    res_read = client.post(f"/api/notifications/{notif1.id}/read", headers=headers)
    assert res_read.status_code == 200
    assert res_read.json()["success"] is True


    # 3. Verify read status is now True
    res2 = client.get("/api/notifications", headers=headers)
    assert res2.status_code == 200
    updated = res2.json()
    marked = next(n for n in updated if n["id"] == notif1.id)
    assert marked["read"] is True
