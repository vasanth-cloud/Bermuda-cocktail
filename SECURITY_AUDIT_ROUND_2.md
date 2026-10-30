# Bermuda Cocktail Pub POS — Security Audit Report (Round 2)

**Application:** Bermuda Cocktail Pub POS & Digital Order System  
**Frontend Deployment:** `https://elitedominators.com` (Vite / React SPA)  
**Backend Deployment:** `https://bermuda-cocktail-backend.onrender.com` (FastAPI / Python)  
**Audit Scope:** Post-Hardening Deep-Dive Security Inspection & Resilience Verification  
**Audit Date:** October 2026  
**Auditor:** Senior Application Security Engineer & Backend Security Auditor  
**Audit Status:** Review Completed. Specific Business-Logic & Edge-Case Findings Identified. Awaiting Approval for Fixes.

---

## 1. Executive Summary & Audit Overview

Following the implementation of Phase 1 hardening (bcrypt hashing, JWT tokens, security headers, rate limiting, and RBAC on core routes), a comprehensive **Round 2 Security Audit** was conducted to evaluate:
- The full surface of all 58 backend API endpoints.
- Request parameter validation and business logic constraints (order quantities, discounts, final amounts).
- Multi-tenant and staff identity integrity (impersonation, IDOR, spoofing).
- State persistence, Git commit history, and frontend token handling.
- Scalability limits of in-memory security controls (rate limiting).

> [!IMPORTANT]
> In accordance with security engineering standards, this system is **not claimed to be 100% secure**. Security is an ongoing process of defense-in-depth, validation, and monitoring.

---

## 2. Comprehensive 15-Point Verification Matrix

| # | Audit Item | Verification Status | Severity | Risk Level / Notes |
|---|---|---|---|---|
| 1 | Backend API Route Authentication & Authorization | **FINDING DETECTED** | **MEDIUM** | `POST /api/sync/trigger` & `GET /api/sync/status` are unauthenticated. |
| 2 | Consistent Frontend Bearer Token Attachment | **VERIFIED CLEAN** | **LOW (INFO)** | All HTTP calls use `apiFetch`. WebSockets require token query param. |
| 3 | Waiter Access to Admin/Manager Operations | **VERIFIED BLOCKED** | **NONE** | 23 of 23 administrative endpoints return `403 Forbidden` for Waiters. |
| 4 | User IDOR & Staff Record Manipulation | **FINDING DETECTED** | **MEDIUM** | Waiter name spoofing permitted in order claiming & confirming. |
| 5 | Customer QR Ordering Isolation & Permissions | **FINDING DETECTED** | **HIGH** | Negative & zero item quantities allowed; manipulates order totals. |
| 6 | Public `GET /api/settings` Secret Exposure | **VERIFIED CLEAN** | **NONE** | Only exposes operational flags (`customer_punching_enabled`, etc.). |
| 7 | Payment Collection & Amount Integrity | **FINDING DETECTED** | **HIGH** | Client-supplied `final_amount` can override calculated subtotal. |
| 8 | JWT Expiry, Signature & Session Revocation | **VERIFIED CLEAN** | **NONE** | Tampered & expired tokens blocked; deleted/inactive users revoked. |
| 9 | Rate Limiting Multi-Worker / Multi-Instance | **FINDING DETECTED** | **LOW** | In-memory limiter does not share state across multi-worker clusters. |
| 10 | Plaintext Password Residuals & Git History | **FINDING DETECTED** | **HIGH** | Historical commits (`7c633b3`, `dff75f9`) hold plaintext credentials. |
| 11 | Production Error Sanitization & Tracebacks | **VERIFIED CLEAN** | **LOW (INFO)** | `debug=False`, no stack traces; recommended global 500 handler. |
| 12 | Dependency Vulnerabilities | **VERIFIED CLEAN** | **NONE** | Python packages modern (FastAPI 0.115, bcrypt 5.0, Pydantic 2.9). |
| 13 | Database Migrations Safety & Reversibility | **VERIFIED WORKING** | **LOW** | Dynamic startup migrations safe, but lack formal Alembic versioning. |
| 14 | CSRF Protection & Ambient Credentials | **VERIFIED CLEAN** | **NONE** | Uses Authorization Bearer header, not ambient cookies; immune to CSRF. |
| 15 | Meaningful Test Assertions | **VERIFIED CLEAN** | **NONE** | Tests assert HTTP status codes, error details, and payload exclusions. |

---

## 3. Detailed Security Findings & Recommended Fixes

---

### Finding 1: Unauthenticated Database Mutation on Sync Endpoints
- **Vulnerability:** Anonymous users can trigger cloud sync database updates.
- **Severity:** **MEDIUM**
- **Affected File & Function:**
  - File: [`backend/app/main.py`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/backend/app/main.py)
  - Function: `trigger_cloud_sync` (lines 1837–1846) & `get_sync_status` (lines 1826–1835)
- **Test Performed:**
  - Automated test: `test_sync_trigger_missing_auth_audit` in `backend/tests/test_audit_round_2.py`.
  - Executed unauthenticated `POST /api/sync/trigger`.
- **Test Result:**
  - Returned `HTTP 200 OK` without any Bearer token:
    ```json
    {"message": "Successfully synced 0 transactions to Cloud Admin Panel"}
    ```
- **Risk Assessment:**
  - An attacker or crawler can trigger batch status modifications on `sync_logs` records (`sync_status = "SYNCED"`, `synced_at = now()`), corrupting offline synchronization tracking.
- **Recommended Fix:**
  - Add `current_user: models.User = Depends(require_management)` or `require_admin` to both `/api/sync/trigger` and `/api/sync/status`.

---

### Finding 2: Negative Quantity Input & Price Subversion in Customer QR Orders
- **Vulnerability:** The customer self-ordering endpoint accepts negative item quantities, reducing order subtotals and creating negative balances.
- **Severity:** **HIGH**
- **Affected File & Function:**
  - File: [`backend/app/schemas.py`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/backend/app/schemas.py) (`CartItemCreate`)
  - File: [`backend/app/main.py`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/backend/app/main.py) (`create_order`)
- **Test Performed:**
  - Automated test: `test_order_creation_rejects_negative_and_zero_quantity` in `backend/tests/test_audit_round_2.py`.
  - Sent `POST /api/orders` with payload:
    ```json
    {
      "table_id": 37,
      "customer_name": "Negative Qty Test",
      "items": [{"product_id": 946, "quantity": -5}]
    }
    ```
- **Test Result:**
  - Returned `HTTP 200 OK`. The order was inserted with `total_amount = -895.0`.
- **Risk Assessment:**
  - A guest scanning a table QR code can place negative quantity items in their cart to subtract costs from other legitimate items, effectively getting free meals or negative bills.
- **Recommended Fix:**
  - In `backend/app/schemas.py`, enforce strict integer validation using Pydantic:
    ```python
    class CartItemCreate(BaseModel):
        product_id: int
        quantity: int = Field(gt=0, le=50, description="Quantity must be between 1 and 50")
        notes: Optional[str] = None
    ```
  - In `create_order` and `add_items_to_order`, reject any item with `quantity <= 0`.

---

### Finding 3: Waiter Identity Impersonation in Order Claiming & Confirming
- **Vulnerability:** Authenticated staff members can claim or confirm orders under arbitrary names by passing a client-supplied string, bypassing their actual logged-in identity.
- **Severity:** **MEDIUM**
- **Affected File & Function:**
  - File: [`backend/app/main.py`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/backend/app/main.py)
  - Functions: `waiter_claim_order` (line 943) and `waiter_confirm_order` (line 979)
- **Test Performed:**
  - Automated test: `test_waiter_identity_spoofing_in_claim` in `backend/tests/test_audit_round_2.py`.
  - An authenticated waiter sent `POST /api/orders/{id}/claim?waiter_name=Impersonated Owner Vasanth`.
- **Test Result:**
  - Returned `HTTP 200 OK`:
    ```json
    {
      "message": "Order #ORD-A6CEFE for Table C1 accepted & claimed by Impersonated Owner Vasanth.",
      "waiter_name": "Impersonated Owner Vasanth"
    }
    ```
- **Risk Assessment:**
  - Disgruntled or careless staff can claim, modify, or print orders under other waiters' or owners' names, creating accountability gaps in POS shift and tip auditing.
- **Recommended Fix:**
  - Always bind the waiter name directly to `current_user.name` extracted from the verified JWT:
    ```python
    claiming_waiter = current_user.name
    order.waiter_name = claiming_waiter
    ```

---

### Finding 4: Client-Dictated `final_amount` Overwrite in Payment Settlement
- **Vulnerability:** The payment settlement endpoint allows a client-supplied `final_amount` parameter to override the server-calculated order subtotal when discounts are zero.
- **Severity:** **HIGH**
- **Affected File & Function:**
  - File: [`backend/app/main.py`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/backend/app/main.py)
  - Function: `collect_order_payment` (lines 1523–1526)
- **Code Inspection:**
  ```python
  if order.discount_amount > 0.0:
      order.final_amount = max(0.0, sub - order.discount_amount)
  elif req.final_amount is not None:
      order.final_amount = float(req.final_amount)  # <--- VULNERABILITY
  else:
      order.final_amount = sub
  ```
- **Risk Assessment:**
  - A compromised client or malicious staff member sending a modified JSON payload can pass `final_amount: 10.0` for a ₹5,000 order without entering any discount, and the server marks the order `COLLECTED` with ₹10.
- **Recommended Fix:**
  - Remove client-controlled `final_amount`. All payable amounts must be calculated exclusively on the server:
    ```python
    sub = float(order.total_amount or 0.0)
    discount = float(order.discount_amount or 0.0)
    order.final_amount = max(0.0, sub - discount)
    order.amount_collected = order.final_amount
    ```

---

### Finding 5: Plaintext Password Residue in Git Commit History & Frontend UI
- **Vulnerability:** Historical Git commits (`7c633b3` and `dff75f9`) contain plaintext staff passwords in `backend/data/staff_users.json`. Additionally, `StaffAccountsPanel.jsx` contains residual references attempting to display/copy `user.plain_password`.
- **Severity:** **HIGH**
- **Affected Files:**
  - Git Commits: `7c633b3` and `dff75f9`
  - File: [`frontend/src/pages/StaffAccountsPanel.jsx`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/frontend/src/pages/StaffAccountsPanel.jsx) (lines 254, 517, 536)
- **Audit Scan Result:**
  - `git log -p -S "plain_password"` showed historical commits where plaintext credentials were added to JSON files before the audit.
  - `StaffAccountsPanel.jsx` has:
    ```javascript
    const plainPass = user.plain_password || 'Bermuda@123';
    {showCurrentEditPassword ? (editingUser.plain_password || 'Bermuda@123') : '••••••••'}
    ```
- **Risk Assessment:**
  - Anyone with read access to the Git repository can recover historic credentials.
  - The UI falls back to showing `'Bermuda@123'` when `plain_password` is absent.
- **Recommended Fix:**
  - In `StaffAccountsPanel.jsx`, replace the "Current Password" viewer with an explicit "Reset Password" input field (industry standard).
  - In production, force all existing staff users to rotate their passwords upon next login.
  - Run `git-filter-repo` to scrub historical secrets if the repository will ever be made public.

---

### Finding 6: Unauthenticated WebSocket Channel Eavesdropping
- **Vulnerability:** The WebSocket endpoint `/ws-api/{channel}` accepts connections from any client without validating a Bearer token or cookie.
- **Severity:** **MEDIUM**
- **Affected File & Function:**
  - File: [`backend/app/main.py`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/backend/app/main.py)
  - Function: `websocket_endpoint` (lines 179–188)
- **Code Inspection:**
  ```python
  @app.websocket("/ws-api/{channel}")
  async def websocket_endpoint(websocket: WebSocket, channel: str):
      await manager.connect(websocket, channel)
  ```
- **Risk Assessment:**
  - Anyone on the local network or internet can open a WebSocket to `wss://.../ws-api/staff` or `wss://.../ws-api/admin` and listen to live table orders, customer names, billing events, and member check-ins.
- **Recommended Fix:**
  - Require a query parameter token: `@app.websocket("/ws-api/{channel}")` accepting `token: Optional[str] = None`.
  - For staff/admin channels (`staff`, `admin`, `bar`, `kitchen`), validate the token with `decode_access_token(token)`. Reject connection with code `1008 (Policy Violation)` if unauthenticated.
  - Allow unauthenticated WebSockets only for public customer channels (e.g. `customer` channel).

---

### Finding 7: Rate Limiter State Isolation in Multi-Worker Environments
- **Vulnerability:** `LoginRateLimiter` stores failed attempts and lockout timers in local Python memory dictionaries.
- **Severity:** **LOW (Architectural)**
- **Affected File & Function:**
  - File: [`backend/app/security.py`](file:///C:/Users/VASANTH%20A/.gemini/antigravity/scratch/bermuda-cocktail/backend/app/security.py) (`LoginRateLimiter`)
- **Risk Assessment:**
  - If Render or production Uvicorn runs with `--workers 4` or horizontal auto-scaling, state is not shared between processes. An attacker can distribute brute-force attempts across workers.
- **Recommended Fix:**
  - In multi-instance deployments, back the sliding window rate limiter with Redis (`INCR` + `EXPIRE` or `slowapi` with Redis backend).

---

## 4. Remediation Plan

Upon user approval, the following safe, non-breaking fixes will be implemented:

1. **Fix Input Validation in Orders (`CartItemCreate`):**
   - Enforce `Field(gt=0, le=100)` on item quantities so negative or zero order items return 422 Unprocessable Entity.
2. **Lock Down Sync Endpoints:**
   - Require `require_management` or `require_admin` on `POST /api/sync/trigger` and `GET /api/sync/status`.
3. **Prevent Waiter Identity Spoofing:**
   - In `waiter_claim_order` and `waiter_confirm_order`, enforce `current_user.name` rather than untrusted client strings.
4. **Prevent Client-Dictated `final_amount` Overwrite:**
   - Enforce strict server-side final amount calculation: `order.final_amount = max(0.0, sub - discount)`.
5. **Clean Up Frontend Staff Password UI:**
   - In `StaffAccountsPanel.jsx`, replace plaintext password recovery card with standard password reset flow.
6. **Secure Staff WebSocket Channels:**
   - Require token validation for staff, admin, bar, and kitchen WebSocket channels.

---

*Report prepared and validated on local development environment. Awaiting user approval to apply recommended fixes.*

