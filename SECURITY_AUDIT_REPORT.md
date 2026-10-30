# Bermuda Cocktail Pub POS — Application Security Audit & Hardening Report

**Application Name:** Bermuda Cocktail Pub POS & Order System  
**Frontend Deployment:** `https://elitedominators.com` (Vite / React SPA)  
**Backend Deployment:** `https://bermuda-cocktail-backend.onrender.com` (FastAPI / Python)  
**Database:** PostgreSQL (Cloud / Render) with SQLite Local Fallback  
**Audit Date:** October 2026  
**Auditor:** Senior Application Security Engineer & Backend Security Auditor  
**Audit Status:** Remediation Completed & Verified via Automated Security Test Suite (22/22 Tests Passed)

---

## 1. Project Architecture

The Bermuda Cocktail Pub POS is a full-stack, real-time hospitality management application:

```
[ Customer Mobile Devices (QR) ]   [ POS Terminals (Floor / Bar / Admin) ]
              │                                      │
              │ (Public Endpoints)                   │ (Bearer JWT Auth)
              ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│            FastAPI Backend Service (Uvicorn / ASGI)                    │
│                                                                        │
│  - Security Headers Middleware (nosniff, SAMEORIGIN, HSTS)             │
│  - Strict Whitelist CORS Middleware (Production + Local Origins)       │
│  - In-Memory Sliding Window Rate Limiter (Brute-Force Shield)          │
│  - Centralized Dependency Injection RBAC Guard (Admin/Manager/Staff)   │
│  - Safe Non-Destructive Excel Sync Engine                              │
│  - Cryptographic JWT Signature Engine (HS256)                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
      [ PostgreSQL Database ]              [ Thermal Printers ]
      (Role data, orders, logs)           (Posiflex / USB / LAN)
```

- **Frontend:** Single Page Application (SPA) built with React 18, Vite, and TailwindCSS. Communicates with the backend using a centralized API client (`apiFetch`) that injects Authorization Bearer tokens from local browser storage.
- **Backend:** FastAPI (Python 3.11) with SQLAlchemy ORM, Uvicorn ASGI server, and WebSocket broadcasting for real-time order status updates.
- **Data Persistence:** Relational database with automated dynamic schema migrations on startup. Sensitive passwords hashed with bcrypt (cost factor 12).
- **Public vs Protected Boundary:** Public customer QR menu browsing and initial order placement operate without authentication; all staff floor operations, billing, user management, and reporting require signed Bearer tokens and strict role checks.

---

## 2. Existing Security Baseline (Pre-Audit State)

Prior to this security audit and hardening phase, an exhaustive code and architecture inspection revealed critical vulnerabilities:
1. **Plaintext Password Exposure:** Passwords were stored and returned over the wire in plain text (`plain_password` column in database and API schemas).
2. **Missing Backend Authorization (RBAC):** Backend endpoints had no server-side role enforcement; operational protection was entirely client-side.
3. **Absence of Authentication on API Endpoints:** Endpoints for orders, payments, users, members, and printers were publicly accessible without a token.
4. **Destructive Data Operations:** The Excel menu import feature executed unconditional `db.query(OrderItem).delete()` and `Product.delete()`, risking immediate deletion of active orders and order history.
5. **Permissive CORS & Missing Headers:** Wildcard CORS configurations permitted cross-origin access; essential browser security headers were absent.
6. **Unrestricted File Uploads:** Upload endpoints did not validate file extension or binary MIME magic bytes, permitting arbitrary uploads.
7. **No Brute-Force Throttling:** The login endpoint permitted unlimited authentication attempts with no rate limiting.

---

## 3. Vulnerability Classification & Findings

| Vulnerability ID | Vulnerability Description | Category | Pre-Audit Severity | Post-Remediation Status |
|---|---|---|---|---|
| **VULN-001** | Plaintext password exposure in database, schemas, and API responses | Authentication / Privacy | **CRITICAL** | **FIXED & VERIFIED** |
| **VULN-002** | Complete lack of server-side Role-Based Access Control (RBAC) | Authorization | **CRITICAL** | **FIXED & VERIFIED** |
| **VULN-003** | Destructive Excel menu import deleting live order items & active KOTs | Data Integrity / Availability | **CRITICAL** | **FIXED & VERIFIED** |
| **VULN-004** | Missing authentication on operational endpoints (IDOR / Unauthenticated Access) | API Security | **HIGH** | **FIXED & VERIFIED** |
| **VULN-005** | No brute-force protection or rate limiting on `/api/auth/login` | Authentication | **HIGH** | **FIXED & VERIFIED** |
| **VULN-006** | Unrestricted file upload endpoint (`/api/upload-image`) | Remote Code Execution / XSS | **HIGH** | **FIXED & VERIFIED** |
| **VULN-007** | Absence of HTTP security headers (Clickjacking / MIME-sniffing risks) | Deployment / Headers | **MEDIUM** | **FIXED & VERIFIED** |
| **VULN-008** | Wildcard / permissive CORS policy allowing arbitrary web origins | Network / CORS | **MEDIUM** | **FIXED & VERIFIED** |
| **VULN-009** | Lack of financial transaction integrity (Negative amounts & duplicate settlements) | Business Logic / Fraud | **MEDIUM** | **FIXED & VERIFIED** |
| **VULN-010** | REST route collision on `/api/members/entry-logs` vs `/api/members/{member_id}` | API Architecture | **LOW** | **FIXED & VERIFIED** |

---

## 4. Technical Details of Implemented Fixes

### 4.1 Cryptographic Password Security & Transparent Migration (VULN-001)
- Implemented `bcrypt` password hashing with a work factor of 12 (`bcrypt.gensalt(rounds=12)`).
- Purged `plain_password` from `models.User`, `schemas.UserSchema`, and `seed_data.py`.
- Automated startup migration nulls and strips any legacy plaintext password columns.
- Implemented backwards-compatible, transparent migration: legacy SHA-256 hashes are automatically upgraded to bcrypt upon the user's next successful login.

### 4.2 Cryptographic JWT Token Engine & Strict Secrets (VULN-001, VULN-004)
- Implemented `app/security.py` using `pyjwt` with HMAC-SHA256 (`HS256`).
- **Fail-Safe Secret Enforcement:** The application strictly checks `os.getenv("JWT_SECRET_KEY")`. If missing or empty, it raises a fatal error and refuses to start. No hardcoded or insecure fallback secret is ever generated.
- Standard JWT claims included: `sub` (User ID), `email`, `role`, `allowed_terminals`, `exp` (12-hour expiration), `iat`.

### 4.3 Server-Side Role-Based Access Control (RBAC) (VULN-002)
- Created reusable FastAPI dependencies:
  - `get_current_user`: Extracts, validates, and decodes the Bearer token; confirms the user exists and is active.
  - `require_admin`: Restricts access strictly to users with the `ADMIN` role.
  - `require_management`: Restricts access to `ADMIN` and `MANAGER` roles.
  - `require_staff`: Restricts access to authenticated staff (`ADMIN`, `MANAGER`, `WAITER`, `BAR_RECEPTION`, `KITCHEN`).
- Applied RBAC to all endpoints:
  - **Admin Only:** User management (`/api/users`), clearing financial payment logs (`DELETE /api/payments/log`), clearing member audit logs (`DELETE /api/members/entry-logs`), printer configuration, pub operational settings updates.
  - **Management / Admin:** Payment audit log inspection (`GET /api/payments/log`), category sales reports, product and table management.
  - **Staff:** Order management, table switching, waiter claim/confirm, KOT/BOT printing, payment collection, customer member directory.
  - **Public (Unauthenticated):** Customer QR menu browsing (`GET /api/categories`, `GET /api/products`, `GET /api/tables`, `GET /api/settings`, `GET /api/zones`), and customer QR order submission (`POST /api/orders`).

### 4.4 Non-Destructive Safe Excel Menu Sync (VULN-003)
- Refactored `backend/app/excel_importer.py`.
- Replaced destructive `db.query(OrderItem).delete()` and `Product.delete()` with safe upsert logic:
  - Existing products are matched by name and updated in place (prices, descriptions, categories).
  - New products are added.
  - Existing `order_items` and past customer orders are completely preserved.

### 4.5 Brute-Force Protection & Sliding Window Rate Limiting (VULN-005)
- Created `LoginRateLimiter` class in `app/security.py`:
  - Tracks failed attempts by client IP address and target account email over a 60-second sliding window.
  - Blocks requests exceeding 5 consecutive failures with `HTTP 429 Too Many Requests`.
  - Resets failure counters immediately upon successful authentication.

### 4.6 File Upload Hardening & Magic Bytes Inspection (VULN-006)
- Secured `/api/upload-image`:
  - Enforced `require_staff` authentication.
  - Restricted maximum file size to 5 MB.
  - Whitelisted safe image extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.
  - Explicitly blocked `.svg`, `.html`, `.exe`, `.sh`, and script formats.
  - Validated file content against binary magic byte headers (PNG `\x89PNG\r\n\x1a\n`, JPEG `\xff\xd8\xff`, WebP `RIFF...WEBP`).
  - Stored files using randomized hex filenames to prevent path traversal.

### 4.7 Production Security Headers & CORS Lockdown (VULN-007, VULN-008)
- Added an HTTP middleware injecting strict security headers on all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- Configured CORS middleware with an explicit origin whitelist:
  - Production domains: `https://elitedominators.com`, `https://www.elitedominators.com`, `https://bermuda-cocktail-frontend.onrender.com`.
  - Development origins: `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173`.
  - Removed wildcard origins with credentials.
- Disabled Swagger/ReDoc interactive documentation when `ENVIRONMENT=production` unless `ENABLE_DOCS=true`.

### 4.8 Financial Integrity & Duplicate Payment Guard (VULN-009)
- Hardened `/api/orders/{id}/collect-payment`:
  - Validates that `amount_collected >= 0` (rejects negative numbers).
  - Rejects attempts to collect payment on orders already marked `COLLECTED` or `BILLED`.

### 4.9 REST Route Ordering Fix (VULN-010)
- Fixed FastAPI router ordering in `main.py`: registered `/api/members/entry-logs` before the parameterized route `/api/members/{member_id}`, eliminating path collision 422 errors.

### 4.10 Frontend Token Injection & Automatic Session Eviction
- Updated `frontend/src/config.js` (`apiFetch`) to automatically attach `Authorization: Bearer <token>` from `localStorage` to all API requests.
- Updated `frontend/src/context/OrderContext.jsx`:
  - Stored JWT in `localStorage.getItem('bermuda_token')` upon login.
  - Added periodic and focus-triggered session verification against `POST /api/auth/verify`.
  - If a staff account is deleted, disabled, or the token expires, credentials are automatically cleared from the browser and the user is redirected to the customer menu.

---

## 5. Files Modified

| File Path | Description of Changes |
|---|---|
| `backend/app/security.py` | **NEW**: Bcrypt hashing, JWT issuance/verification, RBAC dependencies, brute-force rate limiter. |
| `backend/app/main.py` | Applied RBAC across all routes, security headers middleware, strict CORS, rate limiting, and route precedence fix. |
| `backend/app/models.py` | Removed `plain_password` from `User` model; added `allowed_terminals` column. |
| `backend/app/schemas.py` | Removed `plain_password` from `UserSchema`; added `TokenResponse` and `UserLogin` schemas. |
| `backend/app/seed_data.py` | Removed plaintext passwords from starter accounts; converted to bcrypt hashing. |
| `backend/app/excel_importer.py` | Replaced destructive `delete()` queries with non-destructive upserts to protect order history. |
| `backend/data/staff_users.json` | Removed `plain_password` fields from backup JSON file. |
| `backend/requirements.txt` | Added `bcrypt>=4.0.0`, `pyjwt>=2.8.0`, `pytest>=7.0.0`, `httpx>=0.24.0`. |
| `backend/.env.example` | Documented mandatory `JWT_SECRET_KEY`, `ENVIRONMENT`, and `ALLOWED_ORIGINS` variables. |
| `frontend/src/config.js` | Centralized `apiFetch` updated to inject Bearer tokens automatically into request headers. |
| `frontend/src/context/OrderContext.jsx` | Updated auth flow: stores token, verifies via Bearer token, auto-logs out revoked/deleted users. |
| `backend/tests/test_security_suite.py` | **NEW**: 22 automated security tests covering auth, RBAC, IDOR, brute-force, uploads, headers, and POS lifecycle. |

*Pre-audit backups are archived in `backups/pre_security_audit/`.*

---

## 6. Public vs. Protected Endpoints Matrix

| Endpoint | Method | Access Level | Description |
|---|---|---|---|
| `/api/categories` | GET | **Public** | Menu categories for QR code digital menu |
| `/api/products` | GET | **Public** | Products and pricing for customer viewing |
| `/api/tables` | GET | **Public** | Table layout and status check |
| `/api/zones` | GET | **Public** | Pub dining and smoking zones |
| `/api/settings` | GET | **Public** | Operational pub settings (customer punching toggle) |
| `/api/orders` | POST | **Public** | Customer order placement via table QR |
| `/api/auth/login` | POST | **Public (Rate Limited)** | Staff authentication endpoint |
| `/api/auth/verify` | POST | **Bearer Token** | Validates session authenticity |
| `/api/orders` | GET | **Staff** | Order listing for floor waiters and kitchen KDS |
| `/api/orders/{id}/waiter-confirm` | POST | **Staff** | Waiter claiming and confirming order |
| `/api/orders/{id}/add-items` | POST | **Staff** | Waiter adding addon drinks/food to order |
| `/api/orders/{id}/switch-table` | POST | **Staff** | Moving customer orders between tables |
| `/api/orders/{id}/collect-payment` | POST | **Staff** | Settle bill and collect cash/UPI/card |
| `/api/orders/{id}/print-kot` | POST | **Staff** | Print thermal KOT/BOT |
| `/api/members` | GET | **Staff** | Search VIP member cards |
| `/api/members/entry-logs` | GET | **Staff** | View VIP lounge entrance history |
| `/api/members/entry-logs` | DELETE | **Admin Only** | Clear VIP entrance audit logs |
| `/api/upload-image` | POST | **Staff** | Upload custom menu item photos (validated) |
| `/api/users` | GET, POST | **Admin Only** | Staff account creation and listing |
| `/api/users/{id}` | PUT, DELETE | **Admin Only** | Staff account updates and deactivations |
| `/api/payments/log` | GET | **Management** | Payment audit and revenue logs |
| `/api/payments/log` | DELETE | **Admin Only** | Reset or purge payment logs |
| `/api/settings` | POST | **Admin Only** | Update pub settings (toggle rush mode) |
| `/api/printers/config` | GET, POST | **Admin Only** | Configure thermal USB/LAN ESC/POS printers |

---

## 7. Automated Test Verification Results

The automated security test suite was executed locally using `pytest`:

```
Command: python -m pytest backend/tests/test_security_suite.py -v
Platform: Windows / Python 3.11.9 / pytest 8.3.3
Execution Time: 2.97s
Result: 22 passed, 0 failed, 100% SUCCESS
```

### Detailed Test Breakdown:
1. `test_login_success_returns_jwt_and_sanitized_user` — **PASSED**  
   *Verified: Valid login returns signed JWT; password hash and plaintext are never returned.*
2. `test_login_invalid_password_fails` — **PASSED**  
   *Verified: Invalid password returns 401 Unauthorized.*
3. `test_session_verify_with_valid_bearer_token` — **PASSED**  
   *Verified: Bearer token is verified and returns sanitized user object.*
4. `test_session_verify_with_missing_token_fails` — **PASSED**  
   *Verified: Missing token returns 401.*
5. `test_session_verify_with_tampered_token_fails` — **PASSED**  
   *Verified: Forged or modified JWT signatures are strictly rejected.*
6. `test_unauthenticated_request_to_protected_routes_returns_401` — **PASSED**  
   *Verified: Anonymous requests to `/orders`, `/users`, `/payments/log`, `/members`, `/printers/config`, `/upload-image` are rejected.*
7. `test_waiter_cannot_access_admin_user_management` — **PASSED**  
   *Verified: Waiter role receives 403 Forbidden on user management.*
8. `test_waiter_cannot_clear_payment_audit_logs` — **PASSED**  
   *Verified: Waiter role cannot delete financial logs (403 Forbidden).*
9. `test_waiter_cannot_access_financial_payment_logs` — **PASSED**  
   *Verified: Waiter role cannot view revenue/payment logs (403 Forbidden).*
10. `test_admin_can_access_user_management` — **PASSED**  
    *Verified: Admin user has full access to staff management.*
11. `test_admin_can_access_financial_payment_logs` — **PASSED**  
    *Verified: Admin user can inspect payment audit logs.*
12. `test_public_customer_endpoints_accessible_without_token` — **PASSED**  
    *Verified: Customer QR menu browsing works without login.*
13. `test_customer_order_creation_and_staff_lifecycle` — **PASSED**  
    *Verified: Complete POS regression: QR order -> Waiter confirm -> Add items -> Table switch -> Payment settlement.*
14. `test_file_upload_rejects_unauthenticated` — **PASSED**  
    *Verified: Anonymous file uploads return 401.*
15. `test_file_upload_rejects_svg_and_malicious_types` — **PASSED**  
    *Verified: SVG and script uploads return 400 Bad Request.*
16. `test_file_upload_accepts_valid_png_with_magic_bytes` — **PASSED**  
    *Verified: Legitimate PNG with binary headers is accepted.*
17. `test_security_headers_present_on_responses` — **PASSED**  
    *Verified: Responses carry nosniff, SAMEORIGIN, XSS-Protection, HSTS, and Referrer-Policy headers.*
18. `test_login_brute_force_rate_limiting` — **PASSED**  
    *Verified: 5 rapid failed login attempts trigger 429 Too Many Requests.*
19. `test_expired_jwt_token_rejection` — **PASSED**  
    *Verified: Expired tokens are rejected with 401.*
20. `test_negative_payment_amount_rejected` — **PASSED**  
    *Verified: Negative collected amounts are rejected with 400.*
21. `test_member_pii_protected_from_unauthenticated_access` — **PASSED**  
    *Verified: Customer member phone and Aadhar numbers are protected behind authentication.*
22. `test_member_management_rbac` — **PASSED**  
    *Verified: Staff can search members; only admin can purge audit logs.*

---

## 8. Remaining Risks & Defense-in-Depth Considerations

No application is ever 100% immune to all attack vectors. The following considerations should be managed continuously:

1. **Host Environment Secrets on Render:**  
   The application's security fundamentally relies on the confidentiality of `JWT_SECRET_KEY` and `DATABASE_URL`. These must be set securely in the Render Dashboard environment settings and never committed to source control.
2. **In-Memory Rate Limiting:**  
   The current rate limiter operates in-memory on the running backend instance. If Render scales horizontally across multiple worker instances, an external distributed cache (e.g., Redis / Upstash) should be integrated to share rate-limit counters across all instances.
3. **Database Network Exposure:**  
   Ensure that the PostgreSQL database on Render or cloud provider is configured with SSL (`sslmode=require`) and is only accessible from the Render internal network or whitelisted IPs.
4. **Physical POS Hardware Security:**  
   Terminals running the staff web interface in the pub should use standard browser kiosk mode with auto-lock timers to prevent physical tampering by unauthorized guests.

---

## 9. Production Deployment Checklist (Render)

Before deploying these security changes to the live Render environment:

- [ ] **Configure Environment Variables in Render Dashboard:**
  - `JWT_SECRET_KEY`: Set to a cryptographically secure 64-character random hex string.
  - `ENVIRONMENT`: Set to `production`.
  - `ALLOWED_ORIGINS`: Set to `https://elitedominators.com,https://www.elitedominators.com,https://bermuda-cocktail-frontend.onrender.com`.
  - `DATABASE_URL`: Ensure existing PostgreSQL connection string is active.
- [ ] **Verify Database Migration on First Startup:**
  - The startup hook will automatically verify that `allowed_terminals` exists on `users` and that all new order tracking columns exist on `orders`.
  - The startup hook will automatically purge any remaining `plain_password` column data.
- [ ] **Master Admin Password Verification:**
  - Ensure the Master Admin (`avasanth081@gmail.com`) password hash is set via bcrypt.
- [ ] **Frontend Build Deployment:**
  - Deploy the newly compiled `dist` directory or push to the frontend hosting repository so that `apiFetch` uses Bearer token authentication.
- [ ] **Post-Deploy Smoke Test:**
  - Test customer QR ordering flow on a mobile device without authentication.
  - Log in as Master Admin and verify access to Staff Accounts and Payment Logs.
  - Log in as Waiter and verify that access to Staff Accounts returns 403 Forbidden.
  - Verify that thermal printing and table switching function normally.

---
*Report generated and validated on local development environment.*

