import os
import sys
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

test_db_path = os.path.abspath(os.path.join(backend_dir, "bermuda_pub.db"))
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"
os.environ["ENVIRONMENT"] = "development"
if "JWT_SECRET_KEY" not in os.environ:
    os.environ["JWT_SECRET_KEY"] = "a7c9a4f0cc42212797dbae20aa46d64b9b51903751695fd9117aa6a2690cb40c"

from app.main import app, startup_event
from app.database import SessionLocal
from app import models, security

startup_event()
client = TestClient(app)

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

@pytest.fixture(scope="function")
def waiter_token(db_session):
    waiter = db_session.query(models.User).filter(models.User.role == "WAITER").first()
    assert waiter is not None
    return security.create_access_token(waiter)

# --- ROUND 2 SECURITY AUDIT TESTS ---

def test_public_settings_does_not_leak_secrets():
    """Verifies that GET /api/settings only exposes operational flags, zero secrets."""
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    sensitive_keys = ["password", "secret", "jwt", "key", "token", "database", "admin", "postgres"]
    for key in data.keys():
        assert not any(s in key.lower() for s in sensitive_keys), f"Sensitive key {key} leaked in public settings!"

def test_sync_trigger_missing_auth_audit():
    """Audits whether POST /api/sync/trigger allows unauthenticated database updates."""
    res = client.post("/api/sync/trigger")
    # If this returns 200 without a token, it is a confirmed vulnerability
    print(f"\n[AUDIT] POST /api/sync/trigger unauthenticated status: {res.status_code}")
    # We record whether auth is missing
    is_vulnerable = (res.status_code == 200)
    assert not is_vulnerable, "VULNERABILITY: POST /api/sync/trigger is open without authentication!"

def test_order_creation_rejects_negative_and_zero_quantity(db_session):
    """Audits whether customer order creation blocks negative or zero quantities."""
    table = db_session.query(models.PubTable).first()
    product = db_session.query(models.Product).first()
    assert table is not None and product is not None

    payload = {
        "table_id": table.id,
        "customer_name": "Negative Qty Test",
        "items": [{"product_id": product.id, "quantity": -5}]
    }
    res = client.post("/api/orders", json=payload)
    print(f"\n[AUDIT] Order creation with negative quantity status: {res.status_code}")
    # If status is 200, it's vulnerable to negative price manipulation
    assert res.status_code == 422 or res.status_code == 400, "VULNERABILITY: Order accepted negative quantity!"

def test_waiter_identity_spoofing_in_claim(waiter_token, db_session):
    """Audits whether a logged-in waiter can spoof another staff name in order claiming."""
    order = db_session.query(models.Order).filter(models.Order.status == "PENDING").first()
    if not order:
        table = db_session.query(models.PubTable).first()
        prod = db_session.query(models.Product).first()
        order = models.Order(table_id=table.id, order_number="ORD-AUDIT1", customer_name="Test", status="PENDING")
        db_session.add(order)
        db_session.commit()

    headers = {"Authorization": f"Bearer {waiter_token}"}
    res = client.post(
        f"/api/orders/{order.id}/claim",
        headers=headers,
        params={"waiter_name": "Impersonated Owner Vasanth"}
    )
    print(f"\n[AUDIT] Waiter claim spoofing status: {res.status_code}, response: {res.json()}")
    # Check if claiming allows arbitrary spoofed name
    claimed_name = res.json().get("waiter_name")
    assert claimed_name != "Impersonated Owner Vasanth", "VULNERABILITY: Waiter claimed order with spoofed identity!"

