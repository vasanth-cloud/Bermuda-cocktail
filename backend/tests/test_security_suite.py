import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configure isolated environment for automated security testing
test_db_path = os.path.abspath(os.path.join(backend_dir, "bermuda_pub.db"))
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"
os.environ["ENVIRONMENT"] = "development"
if "JWT_SECRET_KEY" not in os.environ:
    os.environ["JWT_SECRET_KEY"] = "a7c9a4f0cc42212797dbae20aa46d64b9b51903751695fd9117aa6a2690cb40c"

from app.main import app, startup_event
from app.database import get_db, SessionLocal
from app import models, security

startup_event()

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def admin_credentials(db_session):
    admin = db_session.query(models.User).filter(models.User.role == "ADMIN").first()
    assert admin is not None, "Admin user must exist"
    # Ensure known password hash for test
    admin_email = admin.email
    admin.password_hash = security.hash_password("Vasanth@123")
    admin.is_active = True
    db_session.commit()
    return {"email": admin_email, "password": "Vasanth@123"}

@pytest.fixture(scope="module")
def waiter_credentials(db_session):
    waiter = db_session.query(models.User).filter(models.User.role == "WAITER").first()
    if not waiter:
        waiter = models.User(
            name="Test Waiter",
            email="testwaiter@bermuda.pub",
            password_hash=security.hash_password("WaiterSecure@123"),
            role="WAITER",
            allowed_terminals="staff,customer",
            is_active=True
        )
        db_session.add(waiter)
        db_session.commit()
        waiter_email = waiter.email
    else:
        waiter_email = waiter.email
        waiter.password_hash = security.hash_password("WaiterSecure@123")
        waiter.is_active = True
        db_session.commit()
    return {"email": waiter_email, "password": "WaiterSecure@123"}

@pytest.fixture(scope="module")
def admin_token(admin_credentials):
    security.login_limiter.record_success("email:" + admin_credentials["email"].lower())
    res = client.post("/api/auth/login", json=admin_credentials)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    return data["access_token"]

@pytest.fixture(scope="module")
def waiter_token(waiter_credentials):
    security.login_limiter.record_success("email:" + waiter_credentials["email"].lower())
    res = client.post("/api/auth/login", json=waiter_credentials)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    return data["access_token"]


# ============================================================================
# 1. AUTHENTICATION & JWT SECURITY TESTS
# ============================================================================

def test_login_success_returns_jwt_and_sanitized_user(admin_credentials):
    """Verifies that successful login issues a valid JWT token and does NOT expose passwords."""
    security.login_limiter.record_success("email:" + admin_credentials["email"].lower())
    res = client.post("/api/auth/login", json=admin_credentials)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert "plain_password" not in data["user"]
    assert "password_hash" not in data["user"]

def test_login_invalid_password_fails(admin_credentials):
    """Verifies that invalid password returns 401 Unauthorized."""
    security.login_limiter.record_success("email:" + admin_credentials["email"].lower())
    res = client.post("/api/auth/login", json={"email": admin_credentials["email"], "password": "WrongPassword!"})
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]

def test_session_verify_with_valid_bearer_token(admin_token):
    """Verifies that /api/auth/verify succeeds with a signed Bearer token."""
    res = client.post("/api/auth/verify", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert "user" in data
    assert "plain_password" not in data["user"]

def test_session_verify_with_missing_token_fails():
    """Verifies that /api/auth/verify fails when no token is provided."""
    res = client.post("/api/auth/verify", json={})
    assert res.status_code == 401

def test_session_verify_with_tampered_token_fails():
    """Verifies that forged or tampered JWT signatures are rejected."""
    tampered = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIn0.invalidsignature12345"
    res = client.post("/api/auth/verify", headers={"Authorization": f"Bearer {tampered}"})
    assert res.status_code == 401


# ============================================================================
# 2. ROLE-BASED ACCESS CONTROL (RBAC) TESTS
# ============================================================================

def test_unauthenticated_request_to_protected_routes_returns_401():
    """Verifies that all operational endpoints reject unauthenticated access."""
    assert client.get("/api/orders").status_code == 401
    assert client.get("/api/users").status_code == 401
    assert client.get("/api/payments/log").status_code == 401
    assert client.get("/api/members").status_code == 401
    assert client.get("/api/printers/config").status_code == 401
    assert client.post("/api/upload-image").status_code == 401

def test_waiter_cannot_access_admin_user_management(waiter_token):
    """Verifies that a WAITER role receives 403 Forbidden on Admin endpoints."""
    headers = {"Authorization": f"Bearer {waiter_token}"}
    res = client.get("/api/users", headers=headers)
    assert res.status_code == 403
    assert "insufficient permissions" in res.json()["detail"].lower() or "forbidden" in res.json()["detail"].lower()

def test_waiter_cannot_clear_payment_audit_logs(waiter_token):
    """Verifies that a WAITER cannot delete financial audit logs."""
    headers = {"Authorization": f"Bearer {waiter_token}"}
    res = client.delete("/api/payments/log", headers=headers)
    assert res.status_code == 403

def test_waiter_cannot_access_financial_payment_logs(waiter_token):
    """Verifies that WAITER cannot access financial logs (restricted to Management/Admin)."""
    headers = {"Authorization": f"Bearer {waiter_token}"}
    res = client.get("/api/payments/log", headers=headers)
    assert res.status_code == 403

def test_admin_can_access_user_management(admin_token):
    """Verifies that ADMIN role has full access to user management."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/users", headers=headers)
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    for u in users:
        assert "plain_password" not in u
        assert "password_hash" not in u

def test_admin_can_access_financial_payment_logs(admin_token):
    """Verifies that ADMIN can view payment audit logs."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/payments/log", headers=headers)
    assert res.status_code == 200
    assert "summary" in res.json()


# ============================================================================
# 3. PUBLIC CUSTOMER ENDPOINTS & POS REGRESSION TESTS
# ============================================================================

def test_public_customer_endpoints_accessible_without_token():
    """Verifies that customers can view the menu and tables without logging in."""
    assert client.get("/api/categories").status_code == 200
    assert client.get("/api/products").status_code == 200
    assert client.get("/api/tables").status_code == 200
    assert client.get("/api/settings").status_code == 200
    assert client.get("/api/zones").status_code == 200

def test_customer_order_creation_and_staff_lifecycle(admin_token, waiter_token, db_session):
    """End-to-end POS workflow: customer order -> waiter confirm -> add item -> table switch -> payment."""
    # 1. Get an active table and product
    table = db_session.query(models.PubTable).first()
    product = db_session.query(models.Product).first()
    assert table is not None and product is not None

    # 2. Customer places order (public)
    order_payload = {
        "table_id": table.id,
        "customer_name": "Automated Test Guest",
        "items": [{"product_id": product.id, "quantity": 1, "notes": "No onion"}]
    }
    create_res = client.post("/api/orders", json=order_payload)
    assert create_res.status_code == 200
    order_data = create_res.json()
    order_id = order_data["id"]
    assert order_id > 0

    # 3. Waiter confirms order
    waiter_headers = {"Authorization": f"Bearer {waiter_token}"}
    confirm_res = client.post(
        f"/api/orders/{order_id}/waiter-confirm",
        headers=waiter_headers,
        params={"waiter_name": "Test Waiter"}
    )
    assert confirm_res.status_code == 200

    # 4. Waiter adds additional items
    add_res = client.post(
        f"/api/orders/{order_id}/add-items",
        headers=waiter_headers,
        json={
            "waiter_name": "Test Waiter",
            "items": [{"product_id": product.id, "quantity": 2, "notes": "Extra spicy"}]
        }
    )
    assert add_res.status_code == 200

    # 5. Waiter switches table to another table
    target_table = db_session.query(models.PubTable).filter(models.PubTable.id != table.id).first()
    if target_table:
        switch_res = client.post(
            f"/api/orders/{order_id}/switch-table",
            headers=waiter_headers,
            json={"new_table_id": target_table.id, "waiter_name": "Test Waiter"}
        )
        assert switch_res.status_code == 200

    # 6. Settle bill and collect payment
    pay_res = client.post(
        f"/api/orders/{order_id}/collect-payment",
        headers=waiter_headers,
        json={
            "payment_mode": "CASH",
            "amount_collected": float(order_data["total_amount"] or 100.0),
            "collected_by": "Test Waiter"
        }
    )
    assert pay_res.status_code == 200

    # 7. Verify duplicate payment prevention
    dup_res = client.post(
        f"/api/orders/{order_id}/collect-payment",
        headers=waiter_headers,
        json={
            "payment_mode": "CASH",
            "amount_collected": 50.0,
            "collected_by": "Test Waiter"
        }
    )
    assert dup_res.status_code == 400
    assert "already been settled" in dup_res.json()["detail"]


# ============================================================================
# 4. FILE UPLOAD SECURITY TESTS
# ============================================================================

def test_file_upload_rejects_unauthenticated():
    """Verifies that anonymous file upload attempts are rejected with 401."""
    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\nfakecontent", "image/png")}
    res = client.post("/api/upload-image", files=files)
    assert res.status_code == 401

def test_file_upload_rejects_svg_and_malicious_types(waiter_token):
    """Verifies that SVG and non-whitelisted extensions are blocked."""
    headers = {"Authorization": f"Bearer {waiter_token}"}
    files = {"file": ("exploit.svg", b"<svg><script>alert(1)</script></svg>", "image/svg+xml")}
    res = client.post("/api/upload-image", headers=headers, files=files)
    assert res.status_code == 400
    assert "SVG and executable formats are rejected" in res.json()["detail"]

def test_file_upload_accepts_valid_png_with_magic_bytes(waiter_token):
    """Verifies that legitimate PNG images with proper signatures succeed."""
    headers = {"Authorization": f"Bearer {waiter_token}"}
    valid_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    files = {"file": ("sample.png", valid_png_bytes, "image/png")}
    res = client.post("/api/upload-image", headers=headers, files=files)
    assert res.status_code == 200
    assert "image_url" in res.json()
    assert res.json()["image_url"].startswith("/uploads/img_")


# ============================================================================
# 5. SECURITY HEADERS VERIFICATION
# ============================================================================

def test_security_headers_present_on_responses():
    """Verifies that strict security headers are sent on HTTP responses."""
    res = client.get("/api/settings")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "SAMEORIGIN"
    assert res.headers.get("x-xss-protection") == "1; mode=block"
    assert "strict-transport-security" in res.headers
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


# ============================================================================
# 6. BRUTE-FORCE RATE LIMITING & EXPIRED TOKEN TESTS
# ============================================================================

def test_login_brute_force_rate_limiting():
    """Verifies that 5 rapid failed login attempts trigger 429 Too Many Requests."""
    target_email = "bruteforcetest@bermuda.pub"
    security.login_limiter.record_success(f"email:{target_email}")

    for i in range(5):
        res = client.post("/api/auth/login", json={"email": target_email, "password": f"badpass{i}"})
        assert res.status_code == 401

    # 6th attempt must be blocked by rate limiter with 429 Too Many Requests
    blocked_res = client.post("/api/auth/login", json={"email": target_email, "password": "anotherbadpass"})
    assert blocked_res.status_code == 429
    assert "Too many failed login attempts" in blocked_res.json()["detail"]

    # Reset limiter for other tests
    security.login_limiter.record_success(f"email:{target_email}")

def test_expired_jwt_token_rejection(db_session):
    """Verifies that expired JWT tokens are strictly rejected."""
    from datetime import timedelta
    admin = db_session.query(models.User).filter(models.User.role == "ADMIN").first()
    assert admin is not None
    # Generate token expired 1 hour ago
    expired_token = security.create_access_token(admin, expires_delta=timedelta(hours=-1))
    res = client.post("/api/auth/verify", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


# ============================================================================
# 7. FINANCIAL INTEGRITY & MEMBER PRIVACY TESTS
# ============================================================================

def test_negative_payment_amount_rejected(waiter_token, db_session):
    """Verifies that negative amount collected is blocked."""
    order = db_session.query(models.Order).first()
    if order:
        headers = {"Authorization": f"Bearer {waiter_token}"}
        res = client.post(
            f"/api/orders/{order.id}/collect-payment",
            headers=headers,
            json={"payment_mode": "CASH", "amount_collected": -50.0}
        )
        assert res.status_code == 400

def test_member_pii_protected_from_unauthenticated_access():
    """Verifies that member phone/Aadhar/address directory is protected."""
    assert client.get("/api/members").status_code == 401
    assert client.get("/api/members/entry-logs").status_code == 401

def test_member_management_rbac(waiter_token, admin_token):
    """Verifies staff can view members, but only admin can clear audit logs."""
    waiter_headers = {"Authorization": f"Bearer {waiter_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Staff can search members
    assert client.get("/api/members", headers=waiter_headers).status_code == 200

    # Staff cannot clear logs
    assert client.delete("/api/members/entry-logs", headers=waiter_headers).status_code == 403

    # Admin can clear logs
    assert client.delete("/api/members/entry-logs", headers=admin_headers).status_code == 200

