import os
import time
import hashlib
import secrets
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

# Ensure dotenv is loaded from backend/.env or root .env
try:
    from dotenv import load_dotenv
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_env = os.path.abspath(os.path.join(base_dir, "..", ".env"))
    root_env = os.path.abspath(os.path.join(base_dir, "..", "..", ".env"))
    if os.path.exists(backend_env):
        load_dotenv(backend_env)
    elif os.path.exists(root_env):
        load_dotenv(root_env)
    else:
        load_dotenv()
except ImportError:
    pass

# 1. Mandatory JWT Secret Key Enforcement (No fallback allowed)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY or not JWT_SECRET_KEY.strip():
    raise RuntimeError(
        "FATAL SECURITY ERROR: 'JWT_SECRET_KEY' environment variable is required and must not be empty. "
        "Please configure a strong 256-bit secret key in your environment or backend/.env file."
    )

JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_HOURS", "12"))

# HTTP Bearer scheme for token extraction
security_bearer = HTTPBearer(auto_error=False)

# 2. Roles Definition
ROLE_ADMIN = "ADMIN"
ROLE_MANAGER = "MANAGER"
ROLE_WAITER = "WAITER"
ROLE_BAR_RECEPTION = "BAR_RECEPTION"
ROLE_KITCHEN_CHEF = "KITCHEN_CHEF"

ALL_STAFF_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_WAITER, ROLE_BAR_RECEPTION, ROLE_KITCHEN_CHEF]
MANAGEMENT_ROLES = [ROLE_ADMIN, ROLE_MANAGER]
ADMIN_ONLY_ROLES = [ROLE_ADMIN]


# 3. Password Hashing & Safe Verification
def hash_password(password: str) -> str:
    """Hash password using bcrypt with standard 12 salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, stored_hash: str) -> tuple[bool, bool]:
    """
    Verifies a plain password against the stored hash.
    Returns:
        (is_valid: bool, needs_migration_to_bcrypt: bool)
    Supports safe transparent upgrade from legacy SHA-256 to bcrypt.
    """
    if not stored_hash or not plain_password:
        return False, False

    # Check if stored_hash is a bcrypt hash ($2b$ or $2a$ format)
    if stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$"):
        try:
            is_valid = bcrypt.checkpw(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))
            return is_valid, False
        except Exception:
            return False, False

    # Legacy SHA-256 fallback for migration
    legacy_sha = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    if legacy_sha == stored_hash:
        return True, True  # Valid, but needs upgrade to bcrypt!

    return False, False


# 4. JWT Token Generation & Verification
def create_access_token(user: models.User, expires_delta: Optional[timedelta] = None) -> str:
    """Create a cryptographically signed JWT access token."""
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    payload = {
        "sub": str(user.id),
        "email": user.email.lower(),
        "name": user.name,
        "role": (user.role or ROLE_WAITER).upper(),
        "allowed_terminals": user.allowed_terminals or "",
        "exp": expire,
        "iat": datetime.utcnow()
    }
    encoded_jwt = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token signature.",
            headers={"WWW-Authenticate": "Bearer"}
        )


# 5. FastAPI Authentication & Authorization Dependencies
def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Extracts Bearer token from request Authorization header,
    decodes claims, and retrieves the active user record from database.
    """
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(auth.credentials)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID in token.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Staff account no longer exists in database or was removed.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff account has been deactivated by an administrator."
        )

    return user


def require_roles(allowed_roles: List[str]):
    """
    Factory dependency checking that current user has one of the allowed roles.
    """
    def role_checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        user_role = (current_user.role or "").upper()
        norm_allowed = [r.upper() for r in allowed_roles]
        if user_role not in norm_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{user_role}' has insufficient permissions for this resource."
            )
        return current_user

    return role_checker


# Convenient Pre-configured Dependencies
require_admin = require_roles(ADMIN_ONLY_ROLES)
require_management = require_roles(MANAGEMENT_ROLES)
require_staff = require_roles(ALL_STAFF_ROLES)


# 6. In-Memory Brute-Force Rate Limiting for Login
class LoginRateLimiter:
    """
    Tracks failed login attempts per client IP and account email.
    Blocks after max_attempts within window_seconds for lockout_seconds.
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 60, lockout_seconds: int = 120):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds
        # key -> list of timestamp floats
        self.failed_attempts: Dict[str, List[float]] = {}
        # key -> lockout expiry timestamp float
        self.lockouts: Dict[str, float] = {}

    def _clean_old(self, key: str, now: float):
        if key in self.failed_attempts:
            self.failed_attempts[key] = [t for t in self.failed_attempts[key] if now - t < self.window_seconds]
            if not self.failed_attempts[key]:
                del self.failed_attempts[key]

    def check_rate_limit(self, identifier: str):
        now = time.time()
        # Check if currently locked out
        if identifier in self.lockouts:
            if now < self.lockouts[identifier]:
                retry_after = int(self.lockouts[identifier] - now)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed login attempts. Please wait {retry_after} seconds before trying again."
                )
            else:
                del self.lockouts[identifier]

        self._clean_old(identifier, now)

    def record_failure(self, identifier: str):
        now = time.time()
        if identifier not in self.failed_attempts:
            self.failed_attempts[identifier] = []
        self.failed_attempts[identifier].append(now)

        if len(self.failed_attempts[identifier]) >= self.max_attempts:
            self.lockouts[identifier] = now + self.lockout_seconds
            del self.failed_attempts[identifier]

    def record_success(self, identifier: str):
        if identifier in self.failed_attempts:
            del self.failed_attempts[identifier]
        if identifier in self.lockouts:
            del self.lockouts[identifier]


login_limiter = LoginRateLimiter(max_attempts=5, window_seconds=60, lockout_seconds=120)


# 7. Short-Lived Single-Use WebSocket Ticket Manager
class WebSocketTicketManager:
    """
    Issues and validates short-lived, single-use authentication tickets for WebSockets.
    Prevents leaking long-lived JWT tokens into URL query strings or proxy logs.
    """
    def __init__(self, ttl_seconds: int = 30):
        self.ttl_seconds = ttl_seconds
        self.tickets: Dict[str, dict] = {}

    def issue_ticket(self, user: models.User) -> str:
        now = time.time()
        self._cleanup(now)
        ticket = secrets.token_urlsafe(32)
        self.tickets[ticket] = {
            "user_id": user.id,
            "role": (user.role or ROLE_WAITER).upper(),
            "name": user.name,
            "email": user.email,
            "expires_at": now + self.ttl_seconds
        }
        return ticket

    def consume_ticket(self, ticket: str) -> Optional[dict]:
        now = time.time()
        self._cleanup(now)
        if not ticket or ticket not in self.tickets:
            return None
        info = self.tickets.pop(ticket)  # Single-use: consumed immediately
        if now > info["expires_at"]:
            return None
        return info

    def _cleanup(self, now: float):
        expired = [t for t, data in self.tickets.items() if now > data["expires_at"]]
        for t in expired:
            del self.tickets[t]


ws_ticket_manager = WebSocketTicketManager(ttl_seconds=30)
