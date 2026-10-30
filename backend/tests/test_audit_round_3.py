import os
import sys
import uuid
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
def admin_user(db_session):
    admin = db_session.query(models.User).filter(models.User.role == "ADMIN").first()
    assert admin is not None
    admin.is_active = True
    db_session.commit()
    return admin

@pytest.fixture(scope="function")
def admin_token(admin_user):
    return security.create_access_token(admin_user)

@pytest.fixture(scope="function")
def waiter_user(db_session):
    waiter = db_session.query(models.User).filter(models.User.role == "WAITER").first()
    if not waiter:
        waiter = models.User(
            name="Ramesh Waiter",
            email="ramesh@bermuda.pub",
            password_hash=security.hash_password("WaiterPass@123"),
            role="WAITER",
            allowed_terminals="customer,staff",
            is_active=True
        )
        db_session.add(waiter)
        db_session.commit()
    else:
        waiter.is_active = True
        db_session.commit()
    return waiter

@pytest.fixture(scope="function")
def waiter_token(waiter_user):
    return security.create_access_token(waiter_user)


# ==============================================================================
# FIX 1: ORDER QUANTITY CONSTRAINTS & BOUNDARY SECURITY
# ==============================================================================

def test_order_creation_rejects_zero_quantity(db_session):
    table = db_session.query(models.PubTable).first()
    prod = db_session.query(models.Product).first()
    payload = {
        "table_id": table.id,
        "customer_name": "Zero Qty",
        "items": [{"product_id": prod.id, "quantity": 0}]
    }
    res = client.post("/api/orders", json=payload)
    assert res.status_code in [400, 422], f"Expected 400/422 for quantity 0, got {res.status_code}"

def test_order_creation_rejects_negative_quantity(db_session):
    table = db_session.query(models.PubTable).first()
    prod = db_session.query(models.Product).first()
    payload = {
        "table_id": table.id,
        "customer_name": "Negative Qty",
        "items": [{"product_id": prod.id, "quantity": -3}]
    }
    res = client.post("/api/orders", json=payload)
    assert res.status_code in [400, 422], f"Expected 400/422 for negative quantity, got {res.status_code}"

def test_order_creation_rejects_excessive_quantity(db_session):
    table = db_session.query(models.PubTable).first()
    prod = db_session.query(models.Product).first()
    payload = {
        "table_id": table.id,
        "customer_name": "Excessive Qty",
        "items": [{"product_id": prod.id, "quantity": 51}]
    }
    res = client.post("/api/orders", json=payload)
    assert res.status_code in [400, 422], f"Expected 400/422 for quantity > 50, got {res.status_code}"

def test_order_creation_accepts_valid_quantity(db_session):
    zone = db_session.query(models.TableZone).first()
    table = models.PubTable(
        table_number=f"TV-{uuid.uuid4().hex[:4].upper()}",
        zone_id=zone.id if zone else 1,
        current_status="VACANT",
        qr_token=f"QR_{uuid.uuid4().hex[:6]}",
        is_active=True
    )
    db_session.add(table)
    db_session.commit()

    prod = db_session.query(models.Product).first()
    payload = {
        "table_id": table.id,
        "customer_name": "Valid Qty Customer",
        "items": [{"product_id": prod.id, "quantity": 2, "notes": "Cold"}]
    }
    res = client.post("/api/orders", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["items"][0]["quantity"] == 2
    assert data["total_amount"] == round(prod.price * 2, 2)

def test_order_add_items_rejects_invalid_quantity(waiter_token, db_session):
    table = db_session.query(models.PubTable).first()
    prod = db_session.query(models.Product).first()
    order = models.Order(table_id=table.id, order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}", customer_name="Add Item Test", status="CONFIRMED")
    db_session.add(order)
    db_session.commit()

    headers = {"Authorization": f"Bearer {waiter_token}"}
    res = client.post(
        f"/api/orders/{order.id}/add-items",
        headers=headers,
        json={"items": [{"product_id": prod.id, "quantity": 99}]}
    )
    assert res.status_code in [400, 422]


# ==============================================================================
# FIX 2: PAYMENT CALCULATION INTEGRITY & DISCOUNT RBAC
# ==============================================================================

def test_payment_ignores_client_supplied_final_amount(waiter_token, db_session):
    table = db_session.query(models.PubTable).first()
    prod = db_session.query(models.Product).first()
    order = models.Order(
        table_id=table.id,
        order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        customer_name="Tamper Test",
        total_amount=500.0,
        status="CONFIRMED"
    )
    db_session.add(order)
    db_session.commit()

    headers = {"Authorization": f"Bearer {waiter_token}"}
    # Attacker tries to send final_amount = 1.0 on a 500.0 order without discount
    payload = {
        "payment_mode": "CASH",
        "amount_collected": 500.0,
        "final_amount": 1.0,
        "discount_percentage": 0.0,
        "discount_amount": 0.0
    }
    res = client.post(f"/api/orders/{order.id}/collect-payment", headers=headers, json=payload)
    assert res.status_code == 200
    db_session.refresh(order)
    # Backend must calculate final_amount as 500.0, completely ignoring client 1.0
    assert order.final_amount == 500.0, f"Vulnerability: client tampered final_amount accepted! Got {order.final_amount}"

def test_waiter_cannot_grant_discount_exceeding_20_percent(waiter_token, db_session):
    table = db_session.query(models.PubTable).first()
    order = models.Order(
        table_id=table.id,
        order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        customer_name="High Discount Test",
        total_amount=1000.0,
        status="CONFIRMED"
    )
    db_session.add(order)
    db_session.commit()

    headers = {"Authorization": f"Bearer {waiter_token}"}
    # Waiter attempts 30% discount
    payload = {
        "payment_mode": "CARD",
        "amount_collected": 700.0,
        "discount_percentage": 30.0
    }
    res = client.post(f"/api/orders/{order.id}/collect-payment", headers=headers, json=payload)
    assert res.status_code == 403, f"Expected 403 Forbidden for waiter discount >20%, got {res.status_code}"

def test_admin_can_grant_high_discount(admin_token, db_session):
    table = db_session.query(models.PubTable).first()
    order = models.Order(
        table_id=table.id,
        order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        customer_name="Admin High Discount",
        total_amount=1000.0,
        status="CONFIRMED"
    )
    db_session.add(order)
    db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "payment_mode": "CARD",
        "amount_collected": 500.0,
        "discount_percentage": 50.0
    }
    res = client.post(f"/api/orders/{order.id}/collect-payment", headers=headers, json=payload)
    assert res.status_code == 200
    db_session.refresh(order)
    assert order.discount_percentage == 50.0
    assert order.final_amount == 500.0

def test_complimentary_billing_requires_beneficiary(admin_token, db_session):
    table = db_session.query(models.PubTable).first()
    order = models.Order(
        table_id=table.id,
        order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        customer_name="Comp Test",
        total_amount=800.0,
        status="CONFIRMED"
    )
    db_session.add(order)
    db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    # Missing beneficiary
    payload = {
        "payment_mode": "OTHER",
        "amount_collected": 0.0,
        "booking_platform": "Complimentary"
    }
    res = client.post(f"/api/orders/{order.id}/collect-payment", headers=headers, json=payload)
    assert res.status_code == 400

    # With beneficiary
    payload["beneficiary_name"] = "Managing Director Guest"
    res_ok = client.post(f"/api/orders/{order.id}/collect-payment", headers=headers, json=payload)
    assert res_ok.status_code == 200
    db_session.refresh(order)
    assert order.payment_status == "COLLECTED"
    assert order.final_amount == 0.0
    assert order.discount_percentage == 100.0


# ==============================================================================
# FIX 3: WAITER IDENTITY CRYPTOGRAPHIC BINDING
# ==============================================================================

def test_order_claim_uses_authenticated_user_identity(waiter_user, waiter_token, db_session):
    table = db_session.query(models.PubTable).first()
    order = models.Order(
        table_id=table.id,
        order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        customer_name="Identity Claim Test",
        status="PENDING"
    )
    db_session.add(order)
    db_session.commit()

    headers = {"Authorization": f"Bearer {waiter_token}"}
    # Attacker passes spoofed name in params
    res = client.post(
        f"/api/orders/{order.id}/claim",
        headers=headers,
        params={"waiter_name": "Spoofed Owner Account"}
    )
    assert res.status_code == 200
    db_session.refresh(order)
    # Must be bound to authenticated waiter_user.name
    assert order.waiter_name == waiter_user.name, f"Expected {waiter_user.name}, got {order.waiter_name}"

def test_order_confirm_uses_authenticated_user_identity(waiter_user, waiter_token, db_session):
    table = db_session.query(models.PubTable).first()
    order = models.Order(
        table_id=table.id,
        order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        customer_name="Identity Confirm Test",
        status="PENDING"
    )
    db_session.add(order)
    db_session.commit()
    db_session.commit()

    headers = {"Authorization": f"Bearer {waiter_token}"}
    res = client.post(
        f"/api/orders/{order.id}/waiter-confirm",
        headers=headers,
        params={"waiter_name": "Spoofed Owner Account"}
    )
    assert res.status_code == 200
    db_session.refresh(order)
    assert order.waiter_name == waiter_user.name


# ==============================================================================
# FIX 4: SYNC API SECURITY & RBAC ENFORCEMENT
# ==============================================================================

def test_sync_status_requires_management_auth(waiter_token, admin_token):
    # Anonymous -> 401
    res_anon = client.get("/api/sync/status")
    assert res_anon.status_code == 401

    # Waiter -> 403 Forbidden
    res_waiter = client.get("/api/sync/status", headers={"Authorization": f"Bearer {waiter_token}"})
    assert res_waiter.status_code == 403

    # Admin -> 200 OK
    res_admin = client.get("/api/sync/status", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200

def test_sync_trigger_requires_admin_auth(waiter_token, admin_token):
    # Anonymous -> 401
    res_anon = client.post("/api/sync/trigger")
    assert res_anon.status_code == 401

    # Waiter -> 403
    res_waiter = client.post("/api/sync/trigger", headers={"Authorization": f"Bearer {waiter_token}"})
    assert res_waiter.status_code == 403

    # Admin -> 200 OK
    res_admin = client.post("/api/sync/trigger", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200


# ==============================================================================
# FIX 5: WEBSOCKET AUTHENTICATION TICKETS
# ==============================================================================

def test_ws_ticket_requires_authenticated_staff(waiter_user, waiter_token):
    # Anonymous cannot generate ticket
    res_anon = client.post("/api/auth/ws-ticket")
    assert res_anon.status_code == 401

    # Authenticated staff gets single-use ticket
    res_staff = client.post("/api/auth/ws-ticket", headers={"Authorization": f"Bearer {waiter_token}"})
    assert res_staff.status_code == 200
    data = res_staff.json()
    assert "ticket" in data and len(data["ticket"]) >= 32
    assert data["expires_in"] == 30

    # Single-use consumption
    ticket = data["ticket"]
    consumed = security.ws_ticket_manager.consume_ticket(ticket)
    assert consumed is not None
    assert consumed["user_id"] == waiter_user.id

    # Second consumption MUST return None (ticket already burned)
    consumed_again = security.ws_ticket_manager.consume_ticket(ticket)
    assert consumed_again is None, "Vulnerability: WebSocket ticket was reused!"


# ==============================================================================
# FIX 6: PASSWORD SECURITY, BCRYPT & CREDENTIAL PRIVACY
# ==============================================================================

def test_user_api_never_exposes_plain_or_hashed_passwords(admin_token):
    res = client.get("/api/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    users = res.json()
    assert len(users) > 0
    for u in users:
        assert "plain_password" not in u, "Vulnerability: plain_password exposed in UserSchema!"
        assert "password_hash" not in u, "Vulnerability: password_hash exposed in UserSchema!"

def test_session_verify_never_exposes_passwords(admin_token):
    res = client.post(
        "/api/auth/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"token": admin_token}
    )
    assert res.status_code == 200
    data = res.json()
    user = data.get("user", {})
    assert "plain_password" not in user
    assert "password_hash" not in user
