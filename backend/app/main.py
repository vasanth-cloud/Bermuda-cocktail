from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File, Body, Request, status
from fastapi.middleware.cors import CORSMiddleware
from app.security import (
    hash_password, verify_password, create_access_token, decode_access_token,
    get_current_user, require_admin, require_management, require_staff,
    require_roles, login_limiter, ws_ticket_manager, ALL_STAFF_ROLES, ROLE_ADMIN, ROLE_MANAGER,
    ROLE_WAITER, ROLE_BAR_RECEPTION, ROLE_KITCHEN_CHEF
)
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import shutil
import os
import json

from app.database import engine, Base, get_db
from app import models, schemas
from app.seed_data import seed_initial_data
from app.services.order_router import manager
from app.services import thermal_printer

STAFF_USERS_JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "staff_users.json"))

def sync_staff_users_to_file(db: Session):
    try:
        users = db.query(models.User).all()
        data = [
            {
                "name": u.name,
                "email": u.email,
                "password_hash": u.password_hash,
                "role": u.role,
                "allowed_terminals": u.allowed_terminals,
                "is_active": u.is_active
            }
            for u in users
        ]
        os.makedirs(os.path.dirname(STAFF_USERS_JSON_PATH), exist_ok=True)
        with open(STAFF_USERS_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[sync_staff_users_to_file] Warning: {e}")

PUB_SETTINGS_JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "pub_settings.json"))

DEFAULT_PUB_SETTINGS = {
    "customer_punching_enabled": True,  # True = customer can add to cart and order; False = view menu only
    "weekend_rush_mode": False,
    "view_only_message": "Digital Menu (View Only Mode) - Due to high rush, customer self-ordering is paused. Our waiter will visit your table to take your order!"
}

def load_pub_settings() -> dict:
    try:
        if os.path.exists(PUB_SETTINGS_JSON_PATH):
            with open(PUB_SETTINGS_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {**DEFAULT_PUB_SETTINGS, **data}
    except Exception as e:
        print(f"[load_pub_settings] Warning: {e}")
    return DEFAULT_PUB_SETTINGS.copy()

def save_pub_settings(settings: dict) -> dict:
    try:
        os.makedirs(os.path.dirname(PUB_SETTINGS_JSON_PATH), exist_ok=True)
        current = load_pub_settings()
        current.update(settings)
        with open(PUB_SETTINGS_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
        return current
    except Exception as e:
        print(f"[save_pub_settings] Warning: {e}")
        return settings


# Create database tables
Base.metadata.create_all(bind=engine)

env_mode = os.getenv("ENVIRONMENT", "development").lower()
is_prod = env_mode == "production"
enable_docs = os.getenv("ENABLE_DOCS", "false").lower() == "true"
docs_url = None if is_prod and not enable_docs else "/docs"
redoc_url = None if is_prod and not enable_docs else "/redoc"

app = FastAPI(
    title="Bermuda Cocktail Pub POS & Order System",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url
)

# Setup uploads directory for custom product image uploads
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Strict Production & Local Allowed Origins Whitelist (No Wildcards)
env_origins = os.getenv("ALLOWED_ORIGINS", "")
parsed_env_origins = [o.strip() for o in env_origins.split(",") if o.strip() and o.strip() != "*"]

DEFAULT_TRUSTED_ORIGINS = [
    "https://elitedominators.com",
    "https://www.elitedominators.com",
    "https://bermuda-cocktail-frontend.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
]

trusted_origins = list(dict.fromkeys(DEFAULT_TRUSTED_ORIGINS + parsed_env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=trusted_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

from sqlalchemy import text, inspect

@app.on_event("startup")
def startup_event():
    # Auto-add missing columns to users & orders tables dynamically
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        if "users" in tables:
            user_cols = [c["name"] for c in inspector.get_columns("users")]
            if "allowed_terminals" not in user_cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN allowed_terminals VARCHAR DEFAULT 'customer,staff'"))
                    conn.commit()
            # Purge plain_password column data for security
            if "plain_password" in user_cols:
                with engine.connect() as conn:
                    conn.execute(text("UPDATE users SET plain_password = NULL WHERE plain_password IS NOT NULL"))
                    conn.commit()

        if "orders" in tables:
            order_cols = [c["name"] for c in inspector.get_columns("orders")]
            col_definitions = {
                "payment_status": "ALTER TABLE orders ADD COLUMN payment_status VARCHAR DEFAULT 'PENDING'",
                "payment_mode": "ALTER TABLE orders ADD COLUMN payment_mode VARCHAR",
                "amount_collected": "ALTER TABLE orders ADD COLUMN amount_collected FLOAT DEFAULT 0.0",
                "collected_by": "ALTER TABLE orders ADD COLUMN collected_by VARCHAR",
                "waiter_name": "ALTER TABLE orders ADD COLUMN waiter_name VARCHAR",
                "booking_platform": "ALTER TABLE orders ADD COLUMN booking_platform VARCHAR DEFAULT 'Direct / Walk-in'",
                "booking_reference_id": "ALTER TABLE orders ADD COLUMN booking_reference_id VARCHAR",
                "discount_percentage": "ALTER TABLE orders ADD COLUMN discount_percentage FLOAT DEFAULT 0.0",
                "discount_amount": "ALTER TABLE orders ADD COLUMN discount_amount FLOAT DEFAULT 0.0",
                "final_amount": "ALTER TABLE orders ADD COLUMN final_amount FLOAT DEFAULT 0.0"
            }
            for col_name, col_cmd in col_definitions.items():
                if col_name not in order_cols:
                    with engine.connect() as conn:
                        conn.execute(text(col_cmd))
                        conn.commit()
    except Exception as e:
        print(f"Database migration inspection warning: {e}")

    db = next(get_db())
    seed_initial_data(db)

# --- WebSocket Ticket & Realtime Endpoint ---
@app.post("/api/auth/ws-ticket", response_model=schemas.WSTicketResponse)
def get_websocket_ticket(current_user: models.User = Depends(require_staff)):
    """
    Issues a short-lived (30-second), single-use WebSocket authentication ticket.
    Protects staff/admin event streams without exposing long-lived JWTs in URL query strings.
    """
    ticket = ws_ticket_manager.issue_ticket(current_user)
    return {"ticket": ticket, "expires_in": ws_ticket_manager.ttl_seconds}

@app.websocket("/ws-api/{channel}")
async def websocket_endpoint(
    websocket: WebSocket, 
    channel: str, 
    ticket: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    # Enforce authentication on all staff and administrative channels
    PRIVATE_STAFF_CHANNELS = ["staff", "admin", "bar", "kitchen", "all"]
    if channel.lower() in PRIVATE_STAFF_CHANNELS:
        ticket_info = ws_ticket_manager.consume_ticket(ticket) if ticket else None
        if not ticket_info:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Valid WebSocket ticket required")
            return

        # Validate that the ticket belongs to an active staff member in the database
        user = db.query(models.User).filter(models.User.id == ticket_info["user_id"]).first()
        if not user or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Staff account is inactive or removed")
            return

        # Check role-specific channel boundaries (e.g. admin channel requires ADMIN role)
        if channel.lower() == "admin" and user.role != ROLE_ADMIN:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Admin privileges required")
            return

    await manager.connect(websocket, channel)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)

# --- System Local IP / Hosting Domain Endpoint ---
import socket

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@app.get("/api/system/ip")
def get_system_ip():
    ip = get_local_ip()
    custom_domain = os.getenv("CUSTOM_DOMAIN", "")
    return {
        "local_ip": ip,
        "default_port": 3000,
        "custom_domain": custom_domain,
        "mode": "ONLINE_CLOUD_HOSTED" if custom_domain else "LOCAL_SERVER",
        "qr_base_url": custom_domain if custom_domain else f"http://{ip}:3000"
    }

# Password hashing imported from app.security

def is_bar_drink_item(it) -> bool:
    """
    Distinguishes bar drinks/cocktails/beverages vs kitchen food items.
    Routes bar drinks to Posiflex (BAR BOT USB002) and food to Kitchen (KITCHEN KOT 192.168.0.70).
    """
    dept = (getattr(it, "target_dept", None) or "").upper().strip()
    if dept in ("BAR", "DRINK", "DRINKS", "BEVERAGE", "BEVERAGES"):
        return True
    if dept in ("KITCHEN", "FOOD"):
        return False

    prod = getattr(it, "product", None)
    if prod:
        p_dept = (getattr(prod, "target_dept", None) or "").upper().strip()
        if p_dept in ("BAR", "DRINK", "DRINKS", "BEVERAGE", "BEVERAGES"):
            return True
        if p_dept in ("KITCHEN", "FOOD"):
            return False

        cat_name = (prod.category.name if prod.category else "").upper()
        if any(w in cat_name for w in ["BAR", "DRINK", "COCKTAIL", "LIQUOR", "BEER", "WINE", "ALCOHOL", "BEVERAGE", "MOCKTAIL", "SPIRIT", "SHOTS"]):
            return True

        prod_name = (prod.name or "").upper()
        if any(w in prod_name for w in [
            "COCKTAIL", "BEER", "WHISKY", "WHISKEY", "VODKA", "RUM", "GIN",
            "TEQUILA", "WINE", "BRANDY", "MOCKTAIL", "SEX ON THE BEACH",
            "MOJITO", "MARGARITA", "MARTINI", "PEPSI", "COKE", "SODA",
            "JUICE", "COOLER", "SHAKE", "SHOT", "DRAUGHT", "BREEZER", "TONIC"
        ]):
            return True

    # If it is a Product object directly (e.g. during order creation)
    if hasattr(it, "price") and hasattr(it, "category"):
        cat_name = (it.category.name if it.category else "").upper()
        if any(w in cat_name for w in ["BAR", "DRINK", "COCKTAIL", "LIQUOR", "BEER", "WINE", "ALCOHOL", "BEVERAGE", "MOCKTAIL", "SPIRIT", "SHOTS"]):
            return True
        prod_name = (it.name or "").upper()
        if any(w in prod_name for w in [
            "COCKTAIL", "BEER", "WHISKY", "WHISKEY", "VODKA", "RUM", "GIN",
            "TEQUILA", "WINE", "BRANDY", "MOCKTAIL", "SEX ON THE BEACH",
            "MOJITO", "MARGARITA", "MARTINI", "PEPSI", "COKE", "SODA",
            "JUICE", "COOLER", "SHAKE", "SHOT", "DRAUGHT", "BREEZER", "TONIC"
        ]):
            return True

    p_name = (getattr(it, "product_name", None) or "").upper()
    if any(w in p_name for w in [
        "COCKTAIL", "BEER", "WHISKY", "WHISKEY", "VODKA", "RUM", "GIN",
        "TEQUILA", "WINE", "BRANDY", "MOCKTAIL", "SEX ON THE BEACH",
        "MOJITO", "MARGARITA", "MARTINI", "PEPSI", "COKE", "SODA",
        "JUICE", "COOLER", "SHAKE", "SHOT", "DRAUGHT", "BREEZER", "TONIC"
    ]):
        return True

    return False


# --- Auth & User Management Endpoints ---
@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login_user(creds: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    clean_email = (creds.email or "").strip().lower()
    client_ip = request.client.host if request.client else "unknown"

    # Enforce brute-force rate limiting
    login_limiter.check_rate_limit(f"ip:{client_ip}")
    login_limiter.check_rate_limit(f"email:{clean_email}")

    user = db.query(models.User).filter(models.User.email.ilike(clean_email)).first()
    if not user:
        login_limiter.record_failure(f"ip:{client_ip}")
        login_limiter.record_failure(f"email:{clean_email}")
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password. This staff account does not exist or has been removed."
        )

    is_valid, needs_migration = verify_password(creds.password, user.password_hash)
    if not is_valid:
        login_limiter.record_failure(f"ip:{client_ip}")
        login_limiter.record_failure(f"email:{clean_email}")
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account has been deactivated by an administrator."
        )

    # Reset rate limiting counter on successful authentication
    login_limiter.record_success(f"ip:{client_ip}")
    login_limiter.record_success(f"email:{clean_email}")

    # Seamless transparent migration from legacy SHA-256 to bcrypt
    if needs_migration:
        user.password_hash = hash_password(creds.password)
        db.commit()

    token = create_access_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": schemas.UserSchema.model_validate(user)
    }

@app.post("/api/auth/verify")
def verify_user_session(
    payload: dict = Body(default={}),
    request: Request = None,
    db: Session = Depends(get_db)
):
    token = payload.get("token")
    if not token and request:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session credentials missing: Valid Bearer token required"
        )

    claims = decode_access_token(token)
    user_id_str = claims.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Malformed session claims")

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid session token user ID")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Staff account no longer exists in database")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Staff account has been deactivated")

    return {
        "valid": True,
        "user": schemas.UserSchema.model_validate(user)
    }

@app.get("/api/users", response_model=List[schemas.UserSchema])
def get_users(current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@app.post("/api/users", response_model=schemas.UserSchema)
def create_staff_user(
    user_data: schemas.UserCreate,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(models.User.email.ilike(user_data.email.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    terminals = user_data.allowed_terminals
    if not terminals:
        if user_data.role.upper() == "ADMIN":
            terminals = "customer,entry_scanner,bar,staff,members,admin"
        else:
            terminals = "customer,staff"

    new_user = models.User(
        name=user_data.name.strip(),
        email=user_data.email.strip().lower(),
        password_hash=hash_password(user_data.password),
        role=user_data.role.upper(),
        allowed_terminals=terminals,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    sync_staff_users_to_file(db)
    return new_user

@app.put("/api/users/{user_id}", response_model=schemas.UserSchema)
def update_staff_user(
    user_id: int,
    user_data: schemas.UserUpdate,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.name is not None:
        user.name = user_data.name.strip()
    if user_data.email is not None and user_data.email.strip():
        clean_email = user_data.email.strip().lower()
        if clean_email != user.email.lower():
            existing = db.query(models.User).filter(models.User.email.ilike(clean_email)).first()
            if existing:
                raise HTTPException(status_code=400, detail="User with this email already exists")
            user.email = clean_email
    if user_data.password is not None and user_data.password.strip():
        user.password_hash = hash_password(user_data.password)
    if user_data.role is not None:
        user.role = user_data.role.upper()
    if user_data.allowed_terminals is not None:
        user.allowed_terminals = user_data.allowed_terminals
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    db.commit()
    db.refresh(user)
    sync_staff_users_to_file(db)
    return user

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email.lower() == "avasanth081@gmail.com":
        raise HTTPException(status_code=400, detail="Cannot delete master admin account")

    deleted_email = user.email
    db.delete(user)
    db.commit()
    sync_staff_users_to_file(db)

    try:
        await manager.broadcast_to_channel("all", {
            "event": "STAFF_USER_DELETED",
            "type": "STAFF_USER_DELETED",
            "user_id": user_id,
            "email": deleted_email
        })
    except Exception as e:
        print(f"Broadcast user deletion error: {e}")

    return {"message": "User deleted successfully", "deleted_id": user_id, "deleted_email": deleted_email}

# --- Table & Zone Endpoints ---
@app.get("/api/zones", response_model=List[schemas.TableZoneSchema])
def get_zones(db: Session = Depends(get_db)):
    return db.query(models.TableZone).all()

@app.get("/api/tables", response_model=List[schemas.PubTableSchema])
def get_tables(zone_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.PubTable)
    if zone_id:
        query = query.filter(models.PubTable.zone_id == zone_id)
    return query.all()

@app.get("/api/tables/{table_id}", response_model=schemas.PubTableSchema)
def get_table_by_id(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.PubTable).filter(models.PubTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table

@app.post("/api/tables", response_model=schemas.PubTableSchema)
async def create_table(table_data: schemas.PubTableCreate, current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    t_num = table_data.table_number.strip().upper()
    existing = db.query(models.PubTable).filter(models.PubTable.table_number == t_num).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Table '{t_num}' already exists")

    qr = f"TOKEN_{t_num.replace('-', '_')}"
    new_table = models.PubTable(
        table_number=t_num,
        zone_id=table_data.zone_id,
        capacity=table_data.capacity or 4,
        qr_token=qr,
        current_status=table_data.current_status or "VACANT",
        is_active=True
    )
    db.add(new_table)
    db.commit()
    db.refresh(new_table)

    await manager.broadcast_all({"event": "TABLE_STATUS_UPDATED", "table_id": new_table.id, "current_status": new_table.current_status})
    return new_table

@app.put("/api/tables/{table_id}", response_model=schemas.PubTableSchema)
async def update_table(table_id: int, table_update: schemas.PubTableUpdate, current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    table = db.query(models.PubTable).filter(models.PubTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if table_update.table_number is not None:
        table.table_number = table_update.table_number.strip().upper()
    if table_update.zone_id is not None:
        table.zone_id = table_update.zone_id
    if table_update.capacity is not None:
        table.capacity = table_update.capacity
    if table_update.current_status is not None:
        table.current_status = table_update.current_status
    if table_update.is_active is not None:
        table.is_active = table_update.is_active

    db.commit()
    db.refresh(table)

    await manager.broadcast_all({"event": "TABLE_STATUS_UPDATED", "table_id": table.id, "current_status": table.current_status})
    return table

@app.delete("/api/tables/{table_id}")
async def delete_table(table_id: int, current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    table = db.query(models.PubTable).filter(models.PubTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    db.delete(table)
    db.commit()
    await manager.broadcast_all({"event": "TABLE_STATUS_UPDATED", "table_id": table_id, "deleted": True})
    return {"message": "Table deleted successfully"}

# --- EDC Addon Master List Endpoint ---
EDC_ADDONS_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "edc_addons.json"))
_edc_addons_cache = None

def get_edc_addons_data():
    global _edc_addons_cache
    if _edc_addons_cache is None:
        if os.path.exists(EDC_ADDONS_FILE):
            try:
                with open(EDC_ADDONS_FILE, "r", encoding="utf-8") as f:
                    _edc_addons_cache = json.load(f)
            except Exception as e:
                print(f"[get_edc_addons_data] Error reading {EDC_ADDONS_FILE}: {e}")
                _edc_addons_cache = {"total": 0, "quick_categories": {}, "items": []}
        else:
            _edc_addons_cache = {"total": 0, "quick_categories": {}, "items": []}
    return _edc_addons_cache

@app.get("/api/addons")
def get_edc_addons(q: Optional[str] = None):
    data = get_edc_addons_data()
    if not q:
        return data
    q_norm = q.strip().lower()
    filtered_items = [it for it in data.get("items", []) if q_norm in it.get("name", "").lower()]
    return {
        "total": len(filtered_items),
        "quick_categories": data.get("quick_categories", {}),
        "items": filtered_items[:100]
    }

# --- Menu Endpoints ---
@app.get("/api/categories", response_model=List[schemas.CategorySchema])
def get_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).all()

@app.get("/api/products", response_model=List[schemas.ProductSchema])
def get_products(category_id: Optional[int] = None, target_dept: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Product)
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if target_dept:
        query = query.filter(models.Product.target_dept == target_dept)
    return query.all()

@app.post("/api/products", response_model=schemas.ProductSchema)
async def create_product(prod_data: schemas.ProductCreate, current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == prod_data.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    new_prod = models.Product(
        name=prod_data.name,
        category_id=prod_data.category_id,
        price=prod_data.price,
        description=prod_data.description,
        target_dept=prod_data.target_dept or category.target_dept,
        is_available=True,
        image_url=prod_data.image_url
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)

    await manager.broadcast_all({"event": "MENU_UPDATED"})
    return new_prod

@app.patch("/api/products/{product_id}", response_model=schemas.ProductSchema)
async def update_product(product_id: int, prod_update: schemas.ProductUpdate, current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = prod_update.model_dump(exclude_unset=True) if hasattr(prod_update, 'model_dump') else prod_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    await manager.broadcast_all({"event": "MENU_UPDATED"})
    return product

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 Megabytes maximum

@app.post("/api/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_staff)
):
    # 1. Validate MIME header
    content_type = (file.content_type or "").lower().strip()
    if content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only standard image formats (JPG, PNG, WebP) are allowed. SVG and executable formats are rejected for security."
        )

    # 2. Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Disallowed image file extension.")

    # 3. Read content with size enforcement
    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Uploaded image exceeds 5MB size limit.")
    if len(file_bytes) < 16:
        raise HTTPException(status_code=400, detail="Image file appears empty or corrupted.")

    # 4. Verify file signature / magic bytes to prevent masquerading
    is_valid_magic = False
    if ext in [".jpg", ".jpeg"] and file_bytes.startswith(b"\xff\xd8\xff"):
        is_valid_magic = True
    elif ext == ".png" and file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        is_valid_magic = True
    elif ext == ".webp" and file_bytes.startswith(b"RIFF") and b"WEBP" in file_bytes[:16]:
        is_valid_magic = True

    if not is_valid_magic:
        raise HTTPException(status_code=400, detail="File content does not match genuine image binary signature.")

    # 5. Save with cryptographically random hex filename
    safe_filename = f"img_{uuid.uuid4().hex[:12]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_filename)
    with open(filepath, "wb") as buffer:
        buffer.write(file_bytes)

    return {"image_url": f"/uploads/{safe_filename}"}

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()

    await manager.broadcast_all({"event": "MENU_UPDATED"})
    return {"message": "Product deleted successfully"}

@app.post("/api/menu/import-excel")
async def trigger_excel_menu_import(current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.excel_importer import import_excel_menu
    success = import_excel_menu(db)
    if success:
        await manager.broadcast_all({"event": "MENU_UPDATED"})
        return {"message": "Menu successfully re-imported and updated from Excel price list!"}
    else:
        raise HTTPException(status_code=500, detail="Failed to import menu from Excel file.")

# --- Order & Split Routing Endpoints ---
@app.post("/api/orders", response_model=schemas.OrderSchema)
async def create_order(order_data: schemas.OrderCreate, request: Request, db: Session = Depends(get_db)):
    table = db.query(models.PubTable).filter(models.PubTable.id == order_data.table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Strict Order Security: validate non-empty items and quantity constraints (1 to 50)
    if not order_data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item.")

    for item in order_data.items:
        if item.quantity <= 0 or item.quantity > 50:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid quantity {item.quantity}. Quantity must be between 1 and 50."
            )

    # Check if customer punching is disabled (Weekend rush mode)
    pub_settings = load_pub_settings()
    if not pub_settings.get("customer_punching_enabled", True):
        auth_header = request.headers.get("Authorization", "") if request else ""
        has_staff_token = False
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_access_token(auth_header.split(" ", 1)[1].strip())
                if payload.get("role") in ALL_STAFF_ROLES:
                    has_staff_token = True
            except Exception:
                pass

        c_name = (order_data.customer_name or "").strip().lower()
        is_staff_order = has_staff_token or any(w in c_name for w in ["waiter", "staff", "admin", "captain", "vasanth", "padmesh", "ajaykumar"])
        if not is_staff_order:
            raise HTTPException(
                status_code=403,
                detail="Customer self-ordering is currently paused during peak rush. Our waiter will visit your table to take your order."
            )

    # Check if this table already has an active order (not yet billed/cancelled)
    active_order = db.query(models.Order).filter(
        models.Order.table_id == table.id,
        models.Order.status.notin_(["BILLED", "CANCELLED"])
    ).first()

    if active_order:
        # Existing active table order -> append newly ordered items as PENDING add-on items
        added_total = 0.0
        bar_items_added = 0
        kitchen_items_added = 0

        for item in order_data.items:
            prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            if not prod:
                continue
            
            item_price = prod.price * item.quantity
            added_total += item_price

            item_dept = "BAR" if is_bar_drink_item(prod) else "KITCHEN"
            order_item = models.OrderItem(
                order_id=active_order.id,
                product_id=prod.id,
                quantity=item.quantity,
                unit_price=prod.price,
                target_dept=item_dept,
                status="PENDING",
                notes=item.notes
            )
            db.add(order_item)

            if item_dept == "BAR":
                bar_items_added += 1
            else:
                kitchen_items_added += 1

        active_order.total_amount += added_total
        active_order.status = "PENDING"  # Alert waiter terminals that new items are pending confirmation
        table.current_status = "OCCUPIED"

        db.commit()
        db.refresh(active_order)

        order_payload = {
            "event": "NEW_ORDER",
            "order_id": active_order.id,
            "order_number": active_order.order_number,
            "table_number": table.table_number,
            "zone_name": table.zone.display_name if table.zone else "Main",
            "customer_name": active_order.customer_name,
            "total_amount": active_order.total_amount,
            "status": active_order.status,
            "created_at": active_order.created_at.isoformat(),
            "bar_items_count": bar_items_added,
            "kitchen_items_count": kitchen_items_added,
            "is_addon": True,
            "items": [
                {
                    "id": it.id,
                    "product_id": it.product_id,
                    "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                    "quantity": it.quantity,
                    "unit_price": it.unit_price,
                    "target_dept": it.target_dept,
                    "status": it.status,
                    "notes": it.notes
                }
                for it in active_order.items
            ]
        }

        await manager.broadcast_to_channel("staff", order_payload)
        await manager.broadcast_to_channel("admin", order_payload)
        return active_order

    order_num = f"ORD-{uuid.uuid4().hex[:6].upper()}"
    total = 0.0

    new_order = models.Order(
        table_id=table.id,
        order_number=order_num,
        customer_name=order_data.customer_name or "Guest",
        status="PENDING",
        total_amount=0.0,
        sync_status="PENDING_SYNC"
    )
    db.add(new_order)
    db.flush()

    bar_items_added = 0
    kitchen_items_added = 0

    for item in order_data.items:
        prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not prod:
            continue
        
        item_price = prod.price * item.quantity
        total += item_price

        item_dept = "BAR" if is_bar_drink_item(prod) else "KITCHEN"
        order_item = models.OrderItem(
            order_id=new_order.id,
            product_id=prod.id,
            quantity=item.quantity,
            unit_price=prod.price,
            target_dept=item_dept,
            status="PENDING",
            notes=item.notes
        )
        db.add(order_item)

        if item_dept == "BAR":
            bar_items_added += 1
        else:
            kitchen_items_added += 1


    new_order.total_amount = total
    table.current_status = "OCCUPIED"

    # Add to Sync Log for offline queue
    sync_entry = models.SyncLog(
        entity_type="ORDER",
        entity_id=order_num,
        action="CREATE",
        sync_status="PENDING"
    )
    db.add(sync_entry)
    db.commit()
    db.refresh(new_order)

    # Convert order to JSON serializable dict for WebSockets
    order_payload = {
        "event": "NEW_ORDER",
        "order_id": new_order.id,
        "order_number": new_order.order_number,
        "table_number": table.table_number,
        "zone_name": table.zone.display_name if table.zone else "Main",
        "customer_name": new_order.customer_name,
        "total_amount": new_order.total_amount,
        "status": new_order.status,
        "created_at": new_order.created_at.isoformat(),
        "bar_items_count": bar_items_added,
        "kitchen_items_count": kitchen_items_added,
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "product_name": it.product.name,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "target_dept": it.target_dept,
                "status": it.status,
                "notes": it.notes
            }
            for it in new_order.items
        ]
    }

    # Broadcast to specific departments via WebSockets
    # Note: Customer orders start as PENDING awaiting waiter review and acceptance.
    # ONLY broadcast to staff (waiter terminals) and admin! DO NOT route to bar or kitchen until accepted!
    await manager.broadcast_to_channel("staff", order_payload)
    await manager.broadcast_to_channel("admin", order_payload)

    return new_order

@app.get("/api/orders", response_model=List[schemas.OrderSchema])
def get_orders(
    target_dept: Optional[str] = None,
    status: Optional[str] = None,
    table_id: Optional[int] = None,
    current_user: models.User = Depends(require_staff),
    db: Session = Depends(get_db)
):
    query = db.query(models.Order)
    if table_id:
        query = query.filter(models.Order.table_id == table_id)
    if status:
        query = query.filter(models.Order.status == status)

    orders = query.order_by(models.Order.created_at.desc()).all()

    # Convert to Pydantic schemas first so we DO NOT mutate SQLAlchemy ORM objects in session
    dtos = [schemas.OrderSchema.model_validate(ord) for ord in orders]

    if target_dept:
        filtered_orders = []
        target_dept_upper = target_dept.upper()
        for dto in dtos:
            # Exclude unaccepted customer orders from Bar & Kitchen KDS!
            # Orders must be accepted by a waiter (e.g. status CONFIRMED, IN_PREP, READY, SERVED)
            if dto.status in ["PENDING", "PENDING_WAITER", "ATTENDING", "CLAIMED", "BILLED"]:
                continue
            dept_items = [it for it in dto.items if (it.target_dept or "").upper() == target_dept_upper]
            if dept_items:
                dto.items = dept_items
                filtered_orders.append(dto)
        return filtered_orders

    return dtos

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: int, status_update: schemas.OrderStatusUpdate, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status_update.status
    db.commit()

    event_payload = {
        "event": "ORDER_STATUS_UPDATED",
        "order_id": order.id,
        "status": order.status,
        "table_number": order.table.table_number
    }
    await manager.broadcast_all(event_payload)
    return {"message": "Order status updated", "status": order.status}

@app.post("/api/orders/{order_id}/claim")
async def waiter_claim_order(
    order_id: int, 
    waiter_name: Optional[str] = "Waiter", 
    req: Optional[schemas.WaiterClaimOrderRequest] = None, 
    current_user: models.User = Depends(require_staff),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Strict Waiter Identity: Authenticated staff member name exclusively
    claiming_waiter = (current_user.name or "Staff").strip()
    order.waiter_name = claiming_waiter
    order.collected_by = claiming_waiter
    order.status = "ATTENDING"
    db.commit()
    db.refresh(order)

    event_payload = {
        "event": "WAITER_CLAIMED_ORDER",
        "order_id": order.id,
        "order_number": order.order_number,
        "table_number": order.table.table_number if order.table else "ST-01",
        "zone_name": order.table.zone.display_name if order.table and order.table.zone else "",
        "waiter_name": claiming_waiter,
        "status": order.status
    }
    await manager.broadcast_all(event_payload)
    return {
        "message": f"Order #{order.order_number} for Table {event_payload['table_number']} accepted & claimed by {claiming_waiter}.",
        "order_id": order.id,
        "waiter_name": claiming_waiter,
        "status": order.status
    }

@app.post("/api/orders/{order_id}/waiter-confirm")
async def waiter_confirm_order(
    order_id: int, 
    waiter_name: Optional[str] = "Waiter", 
    req: Optional[schemas.WaiterConfirmOrderRequest] = None,
    current_user: models.User = Depends(require_staff),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Strict Waiter Identity: Authenticated staff member name exclusively
    effective_waiter = (current_user.name or "Staff").strip()
    order.status = "CONFIRMED"
    order.waiter_name = effective_waiter
    if not order.collected_by:
        order.collected_by = effective_waiter

    # If waiter attached or modified notes/addons on items before confirming, apply them
    if req and req.updated_item_notes:
        note_dict = {n.item_id: n.notes for n in req.updated_item_notes}
        for itm in order.items:
            if itm.id in note_dict:
                itm.notes = note_dict[itm.id]

    # 1. Identify newly pending items before marking them confirmed
    new_pending_items = [it for it in order.items if it.status == "PENDING"]
    # Check if this order already had previously confirmed items (Add-on round)
    is_addon_round = (len(order.items) > len(new_pending_items)) and (len(new_pending_items) > 0)

    # Route ONLY the newly pending items to Kitchen and Bar!
    # If all items were already confirmed and none are pending (e.g. repeated tap), items_to_route is empty.
    items_to_route = new_pending_items

    for item in order.items:
        if item.status == "PENDING":
            item.status = "CONFIRMED"
        # Accurately classify department in DB
        item.target_dept = "BAR" if is_bar_drink_item(item) else "KITCHEN"

    db.commit()
    db.refresh(order)

    # Split ONLY the newly confirmed items into Bar Drinks and Kitchen Food
    bar_items = [it for it in items_to_route if is_bar_drink_item(it)]
    kitchen_items = [it for it in items_to_route if not is_bar_drink_item(it)]

    bar_items_count = len(bar_items)
    kitchen_items_count = len(kitchen_items)

    ticket_order_number = f"{order.order_number}-ADDON" if is_addon_round else order.order_number

    order_payload = {
        "event": "WAITER_CONFIRMED_ORDER",
        "order_id": order.id,
        "order_number": order.order_number,
        "table_number": order.table.table_number if order.table else "ST-01",
        "zone_name": order.table.zone.display_name if order.table and order.table.zone else "Main Zone",
        "customer_name": order.customer_name,
        "total_amount": order.total_amount,
        "status": order.status,
        "confirmed_by": effective_waiter,
        "waiter_name": effective_waiter,
        "bar_items_count": bar_items_count,
        "kitchen_items_count": kitchen_items_count,
        "is_addon": is_addon_round,
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "target_dept": "BAR" if is_bar_drink_item(it) else "KITCHEN",
                "status": it.status,
                "notes": it.notes
            }
            for it in order.items
        ]
    }

    printer_cfg = thermal_printer.load_printer_config()
    t_label = order.table.table_number if order.table else "ST-01"
    z_label = order.table.zone.display_name if order.table and order.table.zone else ""
    full_tbl = f"{t_label} ({z_label})" if z_label else t_label

    # 1. Automatic Food Order Ticket -> Rugtek RP327 Kitchen KOT (Ethernet 192.168.0.70 / KITCHEN KOT)
    if kitchen_items_count > 0:
        await manager.broadcast_to_channel("kitchen", {**order_payload, "dept_filter": "KITCHEN", "trigger_kot_print": True})
        
        if printer_cfg.get("auto_print_kot", True) and printer_cfg.get("kitchen_printer_enabled", True):
            import asyncio
            async def _auto_print_kitchen_job():
                try:
                    k_ip = printer_cfg.get("kitchen_printer_ip", "192.168.0.70")
                    k_port = int(printer_cfg.get("kitchen_printer_port", 9100))
                    k_win = printer_cfg.get("kitchen_printer_windows_name", "KITCHEN KOT")
                    k_items_data = [
                        {
                            "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                            "quantity": it.quantity,
                            "unit_price": it.unit_price,
                            "notes": it.notes
                        }
                        for it in kitchen_items
                    ]
                    kot_data = thermal_printer.build_kot_esc_pos(
                        order_number=ticket_order_number,
                        table_label=full_tbl,
                        waiter_name=effective_waiter or "Staff",
                        items=k_items_data,
                        dept="KITCHEN"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="KITCHEN",
                        ip=k_ip,
                        port=k_port,
                        windows_printer=k_win,
                        data=kot_data,
                        job_title=f"KOT {'Addon ' if is_addon_round else ''}#{order.order_number}"
                    )
                except Exception as ex:
                    print(f"[AutoPrintKitchenKOT] Error: {ex}")
            asyncio.create_task(_auto_print_kitchen_job())

    # 2. Automatic Drinks Order Ticket -> Posiflex Bar BOT Printer (BAR BOT USB002)
    if bar_items_count > 0:
        await manager.broadcast_to_channel("bar", {**order_payload, "dept_filter": "BAR"})
        
        if printer_cfg.get("auto_print_bar_kot", True) and printer_cfg.get("bar_printer_enabled", True):
            import asyncio
            async def _auto_print_bar_job():
                try:
                    bar_win = printer_cfg.get("bar_printer_windows_name", "BAR BOT")
                    b_items_data = [
                        {
                            "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                            "quantity": it.quantity,
                            "unit_price": it.unit_price,
                            "notes": it.notes
                        }
                        for it in bar_items
                    ]
                    bot_data = thermal_printer.build_kot_esc_pos(
                        order_number=ticket_order_number,
                        table_label=full_tbl,
                        waiter_name=effective_waiter or "Staff",
                        items=b_items_data,
                        dept="BAR"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="BAR",
                        windows_printer=bar_win,
                        ip=printer_cfg.get("bar_printer_ip", ""),
                        port=int(printer_cfg.get("bar_printer_port", 9100)),
                        data=bot_data,
                        job_title=f"BOT {'Addon ' if is_addon_round else ''}#{order.order_number}"
                    )
                except Exception as ex:
                    print(f"[AutoPrintBarBOT] Error: {ex}")
            asyncio.create_task(_auto_print_bar_job())

    await manager.broadcast_all(order_payload)
    return {
        "message": f"Order #{order.order_number} confirmed by {effective_waiter} and routed: {kitchen_items_count} food items to Kitchen KOT, {bar_items_count} drinks items to Posiflex Bar",
        "order": order_payload
    }

@app.post("/api/orders/{order_id}/add-items")
async def add_items_to_order(order_id: int, req: schemas.AddItemsToOrderRequest, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not req.items:
        raise HTTPException(status_code=400, detail="Must provide at least one item to add.")

    for it in req.items:
        if it.quantity <= 0 or it.quantity > 50:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid quantity {it.quantity}. Quantity must be between 1 and 50."
            )

    waiter_identity = (current_user.name or "Staff").strip()
    if not order.waiter_name:
        order.waiter_name = waiter_identity

    added_total = 0.0
    added_kitchen_items = []
    added_bar_items = []

    for item in req.items:
        prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not prod:
            continue

        item_price = prod.price * item.quantity
        added_total += item_price

        dept = "BAR" if is_bar_drink_item(prod) else "KITCHEN"

        order_item = models.OrderItem(
            order_id=order.id,
            product_id=prod.id,
            quantity=item.quantity,
            unit_price=prod.price,
            target_dept=dept,
            status="PENDING",
            notes=item.notes
        )
        db.add(order_item)

        item_dict = {
            "product_name": prod.name,
            "quantity": item.quantity,
            "unit_price": prod.price,
            "notes": item.notes
        }
        if dept == "BAR":
            added_bar_items.append(item_dict)
        else:
            added_kitchen_items.append(item_dict)

    order.total_amount += added_total
    db.commit()
    db.refresh(order)

    printer_cfg = thermal_printer.load_printer_config()
    t_lbl = order.table.table_number if order.table else "ST-01"
    z_lbl = order.table.zone.display_name if order.table and order.table.zone else ""
    tbl_str = f"{t_lbl} ({z_lbl})" if z_lbl else t_lbl

    # Auto-dispatch supplemental KOT/BOT ONLY if explicitly requested (by default, waiter confirmation handles printing)
    should_print = getattr(req, "auto_print", False)
    if should_print:
        if added_kitchen_items and printer_cfg.get("auto_print_kot", True) and printer_cfg.get("kitchen_printer_enabled", True):
            import asyncio
            async def _auto_print_addon_kitchen():
                try:
                    k_ip = printer_cfg.get("kitchen_printer_ip", "192.168.0.70")
                    k_port = int(printer_cfg.get("kitchen_printer_port", 9100))
                    k_win = printer_cfg.get("kitchen_printer_windows_name", "KITCHEN KOT")
                    kot_data = thermal_printer.build_kot_esc_pos(
                        order_number=f"{order.order_number}-ADDON",
                        table_label=tbl_str,
                        waiter_name=req.waiter_name or "Waiter",
                        items=added_kitchen_items,
                        dept="KITCHEN"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="KITCHEN",
                        ip=k_ip,
                        port=k_port,
                        windows_printer=k_win,
                        data=kot_data,
                        job_title=f"KOT Addon #{order.order_number}"
                    )
                except Exception as ex:
                    print(f"[AutoPrintKitchenAddon] Error: {ex}")
            asyncio.create_task(_auto_print_addon_kitchen())

        if added_bar_items and printer_cfg.get("auto_print_bar_kot", True) and printer_cfg.get("bar_printer_enabled", True):
            import asyncio
            async def _auto_print_addon_bar():
                try:
                    bar_win = printer_cfg.get("bar_printer_windows_name", "BAR BOT")
                    bot_data = thermal_printer.build_kot_esc_pos(
                        order_number=f"{order.order_number}-ADDON",
                        table_label=tbl_str,
                        waiter_name=req.waiter_name or "Waiter",
                        items=added_bar_items,
                        dept="BAR"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="BAR",
                        windows_printer=bar_win,
                        ip=printer_cfg.get("bar_printer_ip", ""),
                        port=int(printer_cfg.get("bar_printer_port", 9100)),
                        data=bot_data,
                        job_title=f"BOT Addon #{order.order_number}"
                    )
                except Exception as ex:
                    print(f"[AutoPrintBarAddon] Error: {ex}")
            asyncio.create_task(_auto_print_addon_bar())


    await manager.broadcast_all({
        "event": "ORDER_ITEMS_ADDED",
        "order_id": order.id,
        "table_number": order.table.table_number if order.table else "ST-01",
        "added_by": req.waiter_name or "Waiter"
    })
    return {"message": f"Added {len(req.items)} item(s) to order", "new_total": order.total_amount}

@app.post("/api/orders/{order_id}/switch-table")
async def switch_order_table(
    order_id: int, 
    req: schemas.SwitchTableRequest, 
    current_user: models.User = Depends(require_staff),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status in ["BILLED", "CANCELLED"] or order.payment_status == "COLLECTED":
        raise HTTPException(status_code=400, detail="Cannot switch table for an order that is already billed or cancelled.")

    new_table = db.query(models.PubTable).filter(models.PubTable.id == req.new_table_id).first()
    if not new_table:
        raise HTTPException(status_code=404, detail="Destination table not found")

    old_table = order.table
    if old_table and old_table.id == new_table.id:
        raise HTTPException(status_code=400, detail="Order is already on this table.")

    old_tbl_str = f"{old_table.table_number} ({old_table.zone.display_name})" if old_table and old_table.zone else (old_table.table_number if old_table else "Previous Table")
    new_tbl_str = f"{new_table.table_number} ({new_table.zone.display_name})" if new_table.zone else new_table.table_number
    waiter_label = (current_user.name or "Staff").strip()

    # 1. Update Order's Table ID
    order.table_id = new_table.id
    order.waiter_name = waiter_label

    # 2. Update New Table Status to OCCUPIED
    new_table.current_status = "OCCUPIED"

    # 3. Check if Old Table has any other active orders remaining
    if old_table:
        remaining_active = db.query(models.Order).filter(
            models.Order.table_id == old_table.id,
            models.Order.id != order.id,
            ~models.Order.status.in_(["BILLED", "CANCELLED"])
        ).count()
        if remaining_active == 0:
            old_table.current_status = "VACANT"

    # 4. Add sync log
    db.add(models.SyncLog(
        entity_type="ORDER_TABLE_TRANSFER",
        entity_id=order.order_number,
        action="UPDATE",
        sync_status="PENDING"
    ))

    db.commit()
    db.refresh(order)
    db.refresh(new_table)
    if old_table:
        db.refresh(old_table)

    # 5. Thermal Printing: Table Transfer Notice to Kitchen KOT and Bar BOT
    printer_cfg = thermal_printer.load_printer_config()
    should_print = req.print_transfer_slip if req.print_transfer_slip is not None else True

    if should_print:
        order_items_data = [
            {
                "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                "quantity": it.quantity,
                "target_dept": it.target_dept or ("BAR" if is_bar_drink_item(it) else "KITCHEN")
            }
            for it in order.items
        ]
        kitchen_items = [it for it in order_items_data if it["target_dept"] == "KITCHEN"]
        bar_items = [it for it in order_items_data if it["target_dept"] == "BAR"]

        import asyncio
        async def _dispatch_transfer_slips():
            try:
                # Dispatch to Kitchen KOT
                if kitchen_items and printer_cfg.get("kitchen_printer_enabled", True):
                    k_ip = printer_cfg.get("kitchen_printer_ip", "192.168.0.70")
                    k_port = int(printer_cfg.get("kitchen_printer_port", 9100))
                    k_win = printer_cfg.get("kitchen_printer_windows_name", "KITCHEN KOT")
                    k_slip = thermal_printer.build_table_transfer_slip(
                        order_number=order.order_number,
                        old_table_label=old_tbl_str,
                        new_table_label=new_tbl_str,
                        waiter_name=waiter_label,
                        items=kitchen_items,
                        dept="KITCHEN"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="KITCHEN",
                        ip=k_ip,
                        port=k_port,
                        windows_printer=k_win,
                        data=k_slip,
                        job_title=f"Transfer #{order.order_number} to {new_table.table_number}"
                    )

                # Dispatch to Bar BOT
                if bar_items and printer_cfg.get("bar_printer_enabled", True):
                    bar_win = printer_cfg.get("bar_printer_windows_name", "BAR BOT")
                    b_slip = thermal_printer.build_table_transfer_slip(
                        order_number=order.order_number,
                        old_table_label=old_tbl_str,
                        new_table_label=new_tbl_str,
                        waiter_name=waiter_label,
                        items=bar_items,
                        dept="BAR"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="BAR",
                        windows_printer=bar_win,
                        ip=printer_cfg.get("bar_printer_ip", ""),
                        port=int(printer_cfg.get("bar_printer_port", 9100)),
                        data=b_slip,
                        job_title=f"Transfer #{order.order_number} to {new_table.table_number}"
                    )
            except Exception as ex:
                print(f"[TableTransferPrint] Notice: {ex}")

        asyncio.create_task(_dispatch_transfer_slips())

    # 6. Broadcast to all screens via WebSocket
    event_payload = {
        "event": "TABLE_TRANSFERRED",
        "order_id": order.id,
        "order_number": order.order_number,
        "from_table_id": old_table.id if old_table else None,
        "from_table_number": old_table.table_number if old_table else "None",
        "to_table_id": new_table.id,
        "to_table_number": new_table.table_number,
        "new_table_label": new_tbl_str,
        "waiter_name": waiter_label
    }
    await manager.broadcast_all(event_payload)

    return {
        "message": f"Order #{order.order_number} successfully transferred from {old_tbl_str} to {new_tbl_str}!",
        "order_id": order.id,
        "from_table": old_tbl_str,
        "to_table": new_tbl_str
    }

@app.delete("/api/order-items/{item_id}")
async def delete_order_item(item_id: int, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    item = db.query(models.OrderItem).filter(models.OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    order = item.order
    item_cost = item.unit_price * item.quantity
    db.delete(item)

    if order:
        order.total_amount = max(0.0, order.total_amount - item_cost)

    db.commit()

    await manager.broadcast_all({
        "event": "ORDER_ITEM_DELETED",
        "item_id": item_id,
        "order_id": order.id if order else None
    })
    return {"message": "Order item deleted successfully"}

@app.patch("/api/order-items/{item_id}/status")
async def update_item_status(item_id: int, status_update: schemas.ItemStatusUpdate, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    item = db.query(models.OrderItem).filter(models.OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    
    item.status = status_update.status
    db.commit()

    event_payload = {
        "event": "ITEM_STATUS_UPDATED",
        "item_id": item.id,
        "order_id": item.order_id,
        "product_name": item.product.name if item.product else f"Item #{item.product_id}",
        "table_number": item.order.table.table_number if item.order and item.order.table else "Main Table",
        "target_dept": item.target_dept,
        "status": item.status
    }

    # If item marked READY, broadcast pickup alert to waiters
    if item.status == "READY":
        event_payload["event"] = "ITEM_READY_FOR_WAITER"
        await manager.broadcast_to_channel("staff", event_payload)
    
    await manager.broadcast_all(event_payload)
    return {"message": "Item status updated", "status": item.status}

@app.patch("/api/order-items/{item_id}/notes")
async def update_item_notes(item_id: int, req: schemas.ItemNotesUpdate, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    item = db.query(models.OrderItem).filter(models.OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    
    item.notes = req.notes
    db.commit()
    db.refresh(item)

    event_payload = {
        "event": "ITEM_NOTES_UPDATED",
        "item_id": item.id,
        "order_id": item.order_id,
        "notes": item.notes
    }
    await manager.broadcast_all(event_payload)
    return {"message": "Item notes updated", "item_id": item.id, "notes": item.notes}

@app.post("/api/orders/{order_id}/collect-payment")
async def collect_order_payment(
    order_id: int,
    req: schemas.PaymentCollectRequest,
    current_user: models.User = Depends(require_staff),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Double payment prevention
    if order.payment_status == "COLLECTED":
        raise HTTPException(
            status_code=400,
            detail=f"Order #{order.order_number} has already been settled and paid. Duplicate settlement is blocked."
        )

    # Input constraints on financial parameters
    if req.amount_collected < 0:
        raise HTTPException(status_code=400, detail="Amount collected cannot be negative.")
    if req.discount_percentage and (req.discount_percentage < 0 or req.discount_percentage > 100):
        raise HTTPException(status_code=400, detail="Discount percentage must be between 0 and 100.")
    if req.discount_amount and req.discount_amount < 0:
        raise HTTPException(status_code=400, detail="Discount amount cannot be negative.")

    sub = float(order.total_amount or 0.0)
    is_complimentary = (req.payment_mode == "OTHER" or "Complimentary" in (req.booking_platform or ""))
    beneficiary = (req.beneficiary_name or req.notes or req.booking_reference_id or "").strip()

    # RBAC Discount Authorization: Waiters capped at 20% discount without Manager/Admin approval
    if not is_complimentary:
        req_disc_pct = float(req.discount_percentage or 0.0)
        req_disc_amt = float(req.discount_amount or 0.0)
        is_high_discount = req_disc_pct > 20.0 or (sub > 0 and (req_disc_amt / sub) > 0.20)
        if is_high_discount and current_user.role not in [ROLE_ADMIN, ROLE_MANAGER]:
            raise HTTPException(
                status_code=403, 
                detail="Discounts exceeding 20% require Manager or Admin authorization."
            )

    order.payment_status = "COLLECTED"
    order.payment_mode = req.payment_mode
    order.collected_by = (current_user.name or "Staff").strip()

    if is_complimentary:
        if not beneficiary:
            raise HTTPException(status_code=400, detail="Beneficiary name and role is required for complimentary billing.")
        order.payment_mode = "OTHER"
        order.booking_platform = req.booking_platform or "Complimentary (Owners/MD/Bouncers)"
        order.booking_reference_id = beneficiary
        order.discount_percentage = 100.0
        order.discount_amount = sub
        order.final_amount = 0.0
        order.amount_collected = 0.0
    else:
        order.booking_platform = req.booking_platform or "Direct / Walk-in"
        order.booking_reference_id = req.booking_reference_id or None

        disc_pct = float(req.discount_percentage or 0.0)
        disc_amt = float(req.discount_amount or 0.0)

        if disc_amt <= 0.0 and disc_pct > 0.0:
            disc_amt = round((sub * disc_pct) / 100.0, 2)
        elif disc_amt > 0.0 and disc_pct <= 0.0:
            disc_pct = round((disc_amt / sub * 100.0), 2) if sub > 0 else 0.0

        disc_amt = min(sub, max(0.0, disc_amt))
        disc_pct = min(100.0, max(0.0, disc_pct))

        order.discount_percentage = disc_pct
        order.discount_amount = disc_amt

        # Server-calculated final payable amount (Strictly ignore arbitrary client-supplied final_amount)
        order.final_amount = max(0.0, round(sub - disc_amt, 2))
        order.amount_collected = order.final_amount

    order.status = "BILLED"

    if order.table:
        order.table.current_status = "VACANT"

    db.commit()

    # Auto-dispatch 80mm Bill directly to the Rugtek RP327 Cashier Printer (RP327 Printer USB001)
    printer_cfg = thermal_printer.load_printer_config()
    if printer_cfg.get("auto_print_bill", True) and printer_cfg.get("cashier_printer_enabled", True):
        import asyncio
        async def _auto_print_bill():
            try:
                c_win = printer_cfg.get("cashier_printer_windows_name", "RP327 Printer")
                c_ip = printer_cfg.get("cashier_printer_ip", "")
                c_port = int(printer_cfg.get("cashier_printer_port", 9100))
                # BOTH Food AND Drinks together on the same bill with quantities and rates
                order_dict = {
                    "order_number": order.order_number,
                    "table_number": f"{order.table.table_number} ({order.table.zone.display_name})" if order.table and order.table.zone else (order.table.table_number if order.table else "T-01"),
                    "customer_name": order.customer_name or "Guest",
                    "waiter_name": order.waiter_name or order.collected_by or "Staff",
                    "total_amount": float(order.total_amount or 0.0),
                    "discount_percentage": float(order.discount_percentage or 0.0),
                    "discount_amount": float(order.discount_amount or 0.0),
                    "final_amount": float(order.final_amount if order.final_amount is not None else max(0.0, (order.total_amount or 0.0) - (order.discount_amount or 0.0))),
                    "payment_mode": order.payment_mode or "CASH",
                    "booking_platform": order.booking_platform or "Direct / Walk-in",
                    "booking_reference_id": order.booking_reference_id,
                    "items": [
                        {
                            "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                            "quantity": it.quantity,
                            "unit_price": it.unit_price
                        }
                        for it in order.items
                    ]
                }
                bill_data = thermal_printer.build_bill_esc_pos(order_dict)
                await thermal_printer.print_bridge.dispatch_print(
                    target="CASHIER",
                    windows_printer=c_win,
                    ip=c_ip,
                    port=c_port,
                    data=bill_data,
                    job_title=f"Bill #{order.order_number}"
                )
            except Exception as ex:
                print(f"[AutoPrintBill] Notice: {ex}")
        asyncio.create_task(_auto_print_bill())

    event_payload = {
        "event": "PAYMENT_COLLECTED",
        "order_id": order.id,
        "order_number": order.order_number,
        "table_number": order.table.table_number if order.table else "ST-01",
        "payment_mode": order.payment_mode,
        "amount_collected": order.amount_collected,
        "booking_platform": order.booking_platform,
        "booking_reference_id": order.booking_reference_id,
        "discount_percentage": order.discount_percentage,
        "discount_amount": order.discount_amount,
        "collected_by": order.collected_by
    }
    await manager.broadcast_all(event_payload)
    ref_str = f" [ID: {order.booking_reference_id}]" if order.booking_reference_id else ""
    return {"message": f"Payment of ₹{order.amount_collected} collected via {order.payment_mode} ({order.booking_platform}{ref_str})", "order_id": order.id}

@app.get("/api/payments/log")
def get_payment_logs(current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    collected_orders = db.query(models.Order).filter(
        models.Order.payment_status == "COLLECTED"
    ).order_by(models.Order.updated_at.desc()).all()

    logs = []
    total_cash = 0.0
    total_upi = 0.0
    total_card = 0.0
    total_complimentary = 0.0
    complimentary_count = 0
    total_discount_given = 0.0
    platform_counts = {}

    for ord in collected_orders:
        amt = ord.amount_collected if ord.amount_collected is not None else (ord.final_amount if ord.final_amount is not None else ord.total_amount)
        mode = ord.payment_mode or "CASH"
        platform = ord.booking_platform or "Direct / Walk-in"
        disc_pct = ord.discount_percentage or 0.0
        disc_amt = ord.discount_amount or 0.0

        if mode == "CASH":
            total_cash += float(amt or 0.0)
        elif mode == "UPI":
            total_upi += float(amt or 0.0)
        elif mode == "CARD":
            total_card += float(amt or 0.0)
        elif mode == "OTHER" or "Complimentary" in platform:
            total_complimentary += float(ord.total_amount or 0.0)
            complimentary_count += 1

        total_discount_given += float(disc_amt or 0.0)
        platform_counts[platform] = platform_counts.get(platform, 0) + 1

        items_list = []
        for it in ord.items:
            items_list.append({
                "id": it.id,
                "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "target_dept": it.target_dept
            })

        logs.append({
            "order_id": ord.id,
            "order_number": ord.order_number,
            "table_number": ord.table.table_number if ord.table else "ST-01",
            "zone_name": ord.table.zone.display_name if ord.table and ord.table.zone else "Main Zone",
            "amount_collected": amt,
            "subtotal_amount": float(ord.total_amount or 0.0),
            "payment_mode": mode,
            "booking_platform": platform,
            "booking_reference_id": ord.booking_reference_id or "-",
            "discount_percentage": disc_pct,
            "discount_amount": disc_amt,
            "collected_by": ord.collected_by or "Staff",
            "timestamp": ord.updated_at.strftime("%d-%m-%Y %H:%M:%S") if ord.updated_at else ord.created_at.strftime("%d-%m-%Y %H:%M:%S"),
            "items": items_list
        })

    return {
        "summary": {
            "total_cash": total_cash,
            "total_upi": total_upi,
            "total_card": total_card,
            "total_complimentary": total_complimentary,
            "complimentary_count": complimentary_count,
            "grand_total": total_cash + total_upi + total_card,
            "total_discount_given": total_discount_given,
            "total_transactions": len(logs),
            "platform_breakdown": platform_counts
        },
        "logs": logs
    }

@app.delete("/api/payments/log/{order_id}")
async def delete_single_payment_log(order_id: int, current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order log not found")

    order.payment_status = "PENDING"
    order.payment_mode = None
    order.amount_collected = 0.0
    db.commit()

    await manager.broadcast_all({"event": "PAYMENT_COLLECTED"})
    return {"message": f"Payment audit log for order #{order.order_number} deleted successfully"}

@app.delete("/api/payments/log")
async def clear_all_payment_logs(current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    collected_orders = db.query(models.Order).filter(models.Order.payment_status == "COLLECTED").all()
    count = len(collected_orders)
    for ord in collected_orders:
        ord.payment_status = "PENDING"
        ord.payment_mode = None
        ord.amount_collected = 0.0
    db.commit()

    await manager.broadcast_all({"event": "PAYMENT_COLLECTED"})
    return {"message": f"Successfully cleared {count} payment audit log records"}

@app.post("/api/tables/{table_id}/settle")
async def settle_table_bill(table_id: int, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    table = db.query(models.PubTable).filter(models.PubTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Mark active orders as BILLED
    active_orders = db.query(models.Order).filter(
        models.Order.table_id == table_id,
        models.Order.status != "BILLED"
    ).all()

    for ord in active_orders:
        ord.status = "BILLED"
        ord.payment_status = "COLLECTED"

    table.current_status = "VACANT"
    db.commit()

    await manager.broadcast_all({
        "event": "TABLE_SETTLED",
        "table_id": table.id,
        "table_number": table.table_number
    })
    return {"message": f"Table {table.table_number} settled successfully"}

# --- Category & Payment Sales Report Endpoint ---
@app.get("/api/reports/category-summary")
def get_category_sales_report(current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    collected_orders = db.query(models.Order).filter(models.Order.payment_status == "COLLECTED").all()

    total_cash = 0.0
    total_upi = 0.0
    total_card = 0.0
    total_complimentary = 0.0
    complimentary_count = 0
    grand_total_collected = 0.0
    total_discounts = 0.0

    dept_breakdown = {
        "KITCHEN": {"items_sold": 0, "gross_sales": 0.0, "name": "Food & Kitchen"},
        "BAR": {"items_sold": 0, "gross_sales": 0.0, "name": "Bar Drinks & Liquor"}
    }

    category_sales = {}
    platform_sales = {}

    for ord in collected_orders:
        amt = ord.amount_collected if ord.amount_collected is not None else (ord.final_amount if ord.final_amount is not None else (ord.total_amount or 0.0))
        mode = ord.payment_mode or "CASH"
        platform = ord.booking_platform or "Direct / Walk-in"
        disc = ord.discount_amount or 0.0

        if mode == "CASH":
            total_cash += amt
            grand_total_collected += amt
        elif mode == "UPI":
            total_upi += amt
            grand_total_collected += amt
        elif mode == "CARD":
            total_card += amt
            grand_total_collected += amt
        elif mode == "OTHER" or "Complimentary" in platform:
            total_complimentary += float(ord.total_amount or 0.0)
            complimentary_count += 1

        total_discounts += disc

        # Platform summary
        if platform not in platform_sales:
            platform_sales[platform] = {"count": 0, "collected_amount": 0.0, "discount_amount": 0.0}
        platform_sales[platform]["count"] += 1
        platform_sales[platform]["collected_amount"] += amt
        platform_sales[platform]["discount_amount"] += disc

        # Items category breakdown
        for item in ord.items:
            qty = item.quantity or 1
            item_total = qty * (item.unit_price or 0.0)
            dept = (item.target_dept or "KITCHEN").upper()

            if dept in dept_breakdown:
                dept_breakdown[dept]["items_sold"] += qty
                dept_breakdown[dept]["gross_sales"] += item_total

            cat_name = "Uncategorized"
            cat_dept = dept
            cat_id = 0

            if item.product and item.product.category:
                cat_name = item.product.category.name
                cat_dept = (item.product.category.target_dept or dept).upper()
                cat_id = item.product.category.id

            if cat_name not in category_sales:
                category_sales[cat_name] = {
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "target_dept": cat_dept,
                    "items_sold": 0,
                    "total_revenue": 0.0
                }
            category_sales[cat_name]["items_sold"] += qty
            category_sales[cat_name]["total_revenue"] += item_total

    sorted_category_list = sorted(category_sales.values(), key=lambda x: x["total_revenue"], reverse=True)

    return {
        "payment_summary": {
            "total_cash": total_cash,
            "total_upi": total_upi,
            "total_card": total_card,
            "total_complimentary": total_complimentary,
            "complimentary_count": complimentary_count,
            "grand_total": total_cash + total_upi + total_card,
            "total_discounts": total_discounts,
            "total_orders": len(collected_orders)
        },
        "department_summary": dept_breakdown,
        "category_sales": sorted_category_list,
        "platform_sales": platform_sales
    }

# --- Sync Simulation Endpoints ---
@app.get("/api/sync/status")
def get_sync_status(current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    pending_count = db.query(models.SyncLog).filter(models.SyncLog.sync_status == "PENDING").count()
    synced_count = db.query(models.SyncLog).filter(models.SyncLog.sync_status == "SYNCED").count()
    return {
        "pending_sync_count": pending_count,
        "synced_count": synced_count,
        "connection_mode": "OFFLINE_LOCAL_SERVER",
        "cloud_status": "READY_FOR_SYNC"
    }

@app.post("/api/sync/trigger")
def trigger_cloud_sync(current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    pending_logs = db.query(models.SyncLog).filter(models.SyncLog.sync_status == "PENDING").all()
    count = len(pending_logs)
    for log in pending_logs:
        log.sync_status = "SYNCED"
        log.synced_at = models.datetime.utcnow()
    db.commit()
    return {"message": f"Successfully synced {count} transactions to Cloud Admin Panel"}

# --- Member Card Management Endpoints ---
@app.get("/api/members", response_model=List[schemas.CustomerMemberSchema])
def get_members(q: Optional[str] = None, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    query = db.query(models.CustomerMember)
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            (models.CustomerMember.name.ilike(search_pattern)) |
            (models.CustomerMember.phone.ilike(search_pattern)) |
            (models.CustomerMember.member_code.ilike(search_pattern)) |
            (models.CustomerMember.aadhar_number.ilike(search_pattern))
        )
    return query.order_by(models.CustomerMember.created_at.desc()).all()

@app.post("/api/members", response_model=schemas.CustomerMemberSchema)
def create_member(member_data: schemas.CustomerMemberCreate, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    if not member_data.member_code:
        import random
        member_code = f"BMC-{random.randint(1000, 9999)}"
    else:
        member_code = member_data.member_code

    existing = db.query(models.CustomerMember).filter(models.CustomerMember.member_code == member_code).first()
    if existing:
        import random
        member_code = f"BMC-{random.randint(10000, 99999)}"

    new_member = models.CustomerMember(
        member_code=member_code,
        name=member_data.name,
        phone=member_data.phone,
        aadhar_number=member_data.aadhar_number,
        email=member_data.email,
        address=member_data.address,
        status=member_data.status or "ACTIVE",
        discount_percentage=member_data.discount_percentage or 0.0
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member

@app.get("/api/members/{member_identifier}", response_model=schemas.CustomerMemberSchema)
def get_member_by_code(member_identifier: str, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    member = None
    if member_identifier.isdigit():
        member = db.query(models.CustomerMember).filter(models.CustomerMember.id == int(member_identifier)).first()
    if not member:
        member = db.query(models.CustomerMember).filter(
            (models.CustomerMember.member_code == member_identifier) |
            (models.CustomerMember.phone == member_identifier)
        ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

@app.patch("/api/members/{member_id}", response_model=schemas.CustomerMemberSchema)
def update_member(member_id: int, update_data: schemas.CustomerMemberUpdate, current_user: models.User = Depends(require_management), db: Session = Depends(get_db)):
    member = db.query(models.CustomerMember).filter(models.CustomerMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if update_data.name is not None:
        member.name = update_data.name
    if update_data.phone is not None:
        member.phone = update_data.phone
    if update_data.aadhar_number is not None:
        member.aadhar_number = update_data.aadhar_number
    if update_data.email is not None:
        member.email = update_data.email
    if update_data.address is not None:
        member.address = update_data.address
    if update_data.status is not None:
        member.status = update_data.status
    if update_data.discount_percentage is not None:
        member.discount_percentage = update_data.discount_percentage

    db.commit()
    db.refresh(member)
    return member

@app.get("/api/members/entry-logs", response_model=List[schemas.MemberEntryLogSchema])
def get_member_entry_logs(current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    return db.query(models.MemberEntryLog).order_by(models.MemberEntryLog.entry_time.desc()).all()

@app.delete("/api/members/entry-logs")
def clear_member_entry_logs(current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    count = db.query(models.MemberEntryLog).delete()
    db.commit()
    return {"message": f"Successfully cleared {count} member entry log records"}

@app.delete("/api/members/{member_id}")
def delete_member(member_id: int, current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    member = db.query(models.CustomerMember).filter(models.CustomerMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
    return {"message": "Member card deleted successfully"}

@app.post("/api/members/{member_id}/record-visit")
def record_member_visit(member_id: int, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    from datetime import datetime
    member = db.query(models.CustomerMember).filter(models.CustomerMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.visit_count += 1
    
    # Save to entry audit log table
    entry_log = models.MemberEntryLog(
        member_id=member.id,
        member_code=member.member_code,
        name=member.name,
        phone=member.phone,
        status=member.status,
        visit_count=member.visit_count,
        entry_time=datetime.utcnow()
    )
    db.add(entry_log)
    db.commit()
    db.refresh(member)
    return {"message": f"Recorded visit for {member.name}", "visit_count": member.visit_count}

@app.post("/api/members/bulk-import")
def bulk_import_members(members_list: List[schemas.CustomerMemberCreate], current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    import random
    added_count = 0
    skipped_count = 0
    
    existing_codes = set(m[0] for m in db.query(models.CustomerMember.member_code).all())
    
    new_objects = []
    for item in members_list:
        if not item.name or not item.phone:
            skipped_count += 1
            continue
            
        code = item.member_code
        if not code or code in existing_codes:
            code = f"BMC-{random.randint(1000, 99999)}"
            while code in existing_codes:
                code = f"BMC-{random.randint(10000, 999999)}"
        
        existing_codes.add(code)
        
        new_mem = models.CustomerMember(
            member_code=code,
            name=str(item.name).strip(),
            phone=str(item.phone).strip(),
            aadhar_number=str(item.aadhar_number).strip() if item.aadhar_number else None,
            email=str(item.email).strip() if item.email else None,
            address=str(item.address).strip() if item.address else None,
            status=str(item.status).upper() if item.status and str(item.status).upper() in ["ACTIVE", "VIP", "INACTIVE"] else "ACTIVE",
            discount_percentage=0.0
        )
        new_objects.append(new_mem)
        added_count += 1

    if new_objects:
        db.bulk_save_objects(new_objects)
        db.commit()

    return {
        "message": f"Successfully imported {added_count} members into database",
        "added_count": added_count,
        "skipped_count": skipped_count
    }

# --- Pub System Settings Endpoints ---

@app.get("/api/settings")
def get_pub_settings_endpoint():
    """Returns current pub operational settings including customer punching toggle."""
    return load_pub_settings()

@app.post("/api/settings")
async def update_pub_settings_endpoint(settings_data: dict = Body(...), current_user: models.User = Depends(require_admin)):
    """Updates operational settings (e.g. customer punching on/off) and broadcasts to all terminals."""
    updated = save_pub_settings(settings_data)
    await manager.broadcast_all({
        "event": "SETTINGS_UPDATED",
        "settings": updated
    })
    return {"message": "Settings updated successfully", "settings": updated}

# --- Thermal Printer Management & ESC/POS Endpoints ---

@app.get("/api/printers/config")
def get_printer_configuration(current_user: models.User = Depends(require_staff)):
    cfg = thermal_printer.load_printer_config()
    cfg["bridge_connected"] = thermal_printer.print_bridge.is_connected()
    cfg["connected_bridges"] = thermal_printer.print_bridge.get_connected_bridges()
    return cfg

@app.websocket("/api/printers/ws/bridge")
async def printer_bridge_websocket(websocket: WebSocket, client_id: str = Query(default="POS-Terminal")):
    """
    WebSocket channel for the local Bermuda Print Bridge running on the counter PC.
    Relays ESC/POS print jobs from cloud (elitedominators.com) to local LAN printers (192.168.0.70).
    """
    await thermal_printer.print_bridge.register(client_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        thermal_printer.print_bridge.unregister(client_id)
    except Exception:
        thermal_printer.print_bridge.unregister(client_id)

@app.post("/api/printers/config")
def update_printer_configuration(config_data: dict, current_user: models.User = Depends(require_admin)):
    saved = thermal_printer.save_printer_config(config_data)
    saved["bridge_connected"] = thermal_printer.print_bridge.is_connected()
    saved["connected_bridges"] = thermal_printer.print_bridge.get_connected_bridges()
    return {"message": "Printer configuration saved successfully", "config": saved}

@app.post("/api/printers/discover")
async def discover_lan_printers(current_user: models.User = Depends(require_admin)):
    import socket
    from concurrent.futures import ThreadPoolExecutor

    local_ip = get_local_ip()
    base_prefix = ".".join(local_ip.split(".")[:3])

    candidates = [f"{base_prefix}.{i}" for i in range(1, 255)]
    # Always include known printer and gateway IPs across 192.168.0.x and 192.168.1.x
    candidates.extend([
        "192.168.0.70", "192.168.1.70", "192.168.0.87", "192.168.1.87",
        "192.168.0.100", "192.168.1.100", "192.168.0.200", "192.168.1.200",
        "192.168.0.201", "192.168.1.201", "192.168.123.100"
    ])
    candidates = list(dict.fromkeys(candidates))

    found = []
    def probe(ip):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.3)
            res = s.connect_ex((ip, 9100))
            s.close()
            if res == 0:
                return ip
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=50) as executor:
        for res in executor.map(probe, candidates):
            if res:
                found.append(res)

    return {
        "local_subnet": f"{base_prefix}.x",
        "found_printers": found,
        "message": f"Found {len(found)} thermal printer(s) on LAN: {', '.join(found)}" if found else f"No port 9100 printers responding on {base_prefix}.x. If using elitedominators.com (cloud), start the local Print Bridge on the counter PC to connect cloud to pub printers."
    }

@app.post("/api/printers/test")
async def test_printer_connection(req: dict = {}, current_user: models.User = Depends(require_admin)):
    cfg = thermal_printer.load_printer_config()
    target = (req.get("target") or "KITCHEN").upper()

    if target == "CASHIER":
        default_name = cfg.get("cashier_printer_model", "Rugtek RP327 (Cashier / Billing)")
        default_win = cfg.get("cashier_printer_windows_name", "RP327 Printer")
        default_ip = cfg.get("cashier_printer_ip", "")
        default_port = cfg.get("cashier_printer_port", 9100)
        conn_type = f"USB Type-B (Port: {cfg.get('cashier_printer_port_name', 'USB001')} -> {default_win})"
    elif target == "BAR":
        default_name = cfg.get("bar_printer_model", "Posiflex (Bar BOT)")
        default_win = cfg.get("bar_printer_windows_name", "BAR BOT")
        default_ip = cfg.get("bar_printer_ip", "")
        default_port = cfg.get("bar_printer_port", 9100)
        conn_type = f"USB Type-B (Port: {cfg.get('bar_printer_port_name', 'USB002')} -> {default_win})"
    else:
        default_name = cfg.get("kitchen_printer_model", "Rugtek RP327 (Kitchen KOT)")
        default_win = cfg.get("kitchen_printer_windows_name", "KITCHEN KOT")
        default_ip = cfg.get("kitchen_printer_ip", "192.168.0.70")
        default_port = cfg.get("kitchen_printer_port", 9100)
        conn_type = f"Ethernet LAN ({default_ip}:{default_port})"

    name = req.get("printer_name") or default_name
    win_name = req.get("windows_printer") or default_win
    ip = req.get("ip") or default_ip
    port = int(req.get("port") or default_port)

    test_slip_bytes = thermal_printer.build_test_slip(printer_name=name, ip=ip, port=port, connection_type=conn_type)
    success, message = await thermal_printer.print_bridge.dispatch_print(
        target=target,
        ip=ip,
        port=port,
        windows_printer=win_name,
        data=test_slip_bytes,
        job_title=f"{name} Hardware Test"
    )

    return {
        "success": success,
        "message": message,
        "ip": ip,
        "port": port,
        "target": target,
        "windows_printer": win_name,
        "bridge_active": thermal_printer.print_bridge.is_connected()
    }

@app.post("/api/printers/print-kot/{order_id}")
async def print_order_kot(order_id: int, req: dict = {}, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cfg = thermal_printer.load_printer_config()
    ip = req.get("ip") or cfg.get("kitchen_printer_ip", "192.168.0.70")
    port = int(req.get("port") or cfg.get("kitchen_printer_port", 9100))
    win_name = req.get("windows_printer") or cfg.get("kitchen_printer_windows_name", "KITCHEN KOT")

    # Filter kitchen food items
    kitchen_items = [
        {
            "product_name": it.product.name if it.product else f"Item #{it.product_id}",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "notes": it.notes
        }
        for it in order.items
        if not is_bar_drink_item(it)
    ]

    if not kitchen_items:
        kitchen_items = [
            {
                "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "notes": it.notes
            }
            for it in order.items
        ]

    table_str = order.table.table_number if order.table else "T-01"
    zone_str = order.table.zone.display_name if order.table and order.table.zone else ""
    table_label = f"{table_str} ({zone_str})" if zone_str else table_str

    kot_bytes = thermal_printer.build_kot_esc_pos(
        order_number=order.order_number,
        table_label=table_label,
        waiter_name=order.waiter_name or order.collected_by or "Staff",
        items=kitchen_items,
        dept="KITCHEN",
        created_at_str=order.created_at.strftime("%d-%b-%Y %I:%M %p") if order.created_at else None
    )

    success, message = await thermal_printer.print_bridge.dispatch_print(
        target="KITCHEN",
        ip=ip,
        port=port,
        windows_printer=win_name,
        data=kot_bytes,
        job_title=f"KOT #{order.order_number}"
    )
    return {
        "success": success,
        "message": message,
        "order_number": order.order_number,
        "items_printed": len(kitchen_items),
        "target": "KITCHEN",
        "bridge_active": thermal_printer.print_bridge.is_connected()
    }

@app.post("/api/printers/print-bot/{order_id}")
async def print_order_bot(order_id: int, req: dict = {}, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    """Prints Bar Order Ticket (BOT) for cocktails & drinks to Posiflex (BAR BOT USB002)."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cfg = thermal_printer.load_printer_config()
    win_name = req.get("windows_printer") or cfg.get("bar_printer_windows_name", "BAR BOT")

    # Filter bar drink items
    bar_items = [
        {
            "product_name": it.product.name if it.product else f"Item #{it.product_id}",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "notes": it.notes
        }
        for it in order.items
        if is_bar_drink_item(it)
    ]

    if not bar_items:
        bar_items = [
            {
                "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "notes": it.notes
            }
            for it in order.items
        ]

    table_str = order.table.table_number if order.table else "T-01"
    zone_str = order.table.zone.display_name if order.table and order.table.zone else ""
    table_label = f"{table_str} ({zone_str})" if zone_str else table_str

    bot_bytes = thermal_printer.build_kot_esc_pos(
        order_number=order.order_number,
        table_label=table_label,
        waiter_name=order.waiter_name or order.collected_by or "Staff",
        items=bar_items,
        dept="BAR",
        created_at_str=order.created_at.strftime("%d-%b-%Y %I:%M %p") if order.created_at else None
    )

    success, message = await thermal_printer.print_bridge.dispatch_print(
        target="BAR",
        windows_printer=win_name,
        data=bot_bytes,
        job_title=f"BOT #{order.order_number}"
    )
    return {
        "success": success,
        "message": message,
        "order_number": order.order_number,
        "items_printed": len(bar_items),
        "target": "BAR",
        "windows_printer": win_name,
        "bridge_active": thermal_printer.print_bridge.is_connected()
    }

@app.post("/api/printers/print-bill/{order_id}")
async def print_order_bill(order_id: int, req: dict = {}, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cfg = thermal_printer.load_printer_config()
    win_name = req.get("windows_printer") or cfg.get("cashier_printer_windows_name", "RP327 Printer")
    ip = req.get("ip") or cfg.get("cashier_printer_ip", "")
    port = int(req.get("port") or cfg.get("cashier_printer_port", 9100))

    order_dict = {
        "order_number": order.order_number,
        "table_number": f"{order.table.table_number} ({order.table.zone.display_name})" if order.table and order.table.zone else (order.table.table_number if order.table else "T-01"),
        "customer_name": order.customer_name or "Guest",
        "waiter_name": order.waiter_name or order.collected_by or "Staff",
        "total_amount": float(order.total_amount or 0.0),
        "discount_percentage": float(order.discount_percentage or 0.0),
        "discount_amount": float(order.discount_amount or 0.0),
        "final_amount": float(order.final_amount if order.final_amount is not None else max(0.0, (order.total_amount or 0.0) - (order.discount_amount or 0.0))),
        "payment_mode": order.payment_mode or "PENDING",
        "booking_platform": order.booking_platform or "Direct / Walk-in",
        "items": [
            {
                "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                "quantity": it.quantity,
                "unit_price": it.unit_price
            }
            for it in order.items
        ]
    }

    bill_bytes = thermal_printer.build_bill_esc_pos(order_dict)
    success, message = await thermal_printer.print_bridge.dispatch_print(
        target="CASHIER",
        ip=ip,
        port=port,
        windows_printer=win_name,
        data=bill_bytes,
        job_title=f"Bill #{order.order_number}"
    )
    return {
        "success": success,
        "message": message,
        "order_number": order.order_number,
        "target": "CASHIER",
        "windows_printer": win_name,
        "bridge_active": thermal_printer.print_bridge.is_connected()
    }


@app.post("/api/printers/auto-route/{order_id}")
async def auto_route_order_kots(order_id: int, req: dict = {}, current_user: models.User = Depends(require_staff), db: Session = Depends(get_db)):
    """
    Automatically routes an active order's items to their respective KOT printers:
    - Food items -> Kitchen KOT (Ethernet 192.168.0.70:9100 / Windows KITCHEN KOT)
    - Drinks items -> Posiflex (BAR BOT on USB002)
    Zero manual printer selection required.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cfg = thermal_printer.load_printer_config()
    table_str = order.table.table_number if order.table else "T-01"
    zone_str = order.table.zone.display_name if order.table and order.table.zone else ""
    table_label = f"{table_str} ({zone_str})" if zone_str else table_str
    waiter_str = order.waiter_name or order.collected_by or "Staff"
    created_str = order.created_at.strftime("%d-%b-%Y %I:%M %p") if order.created_at else None

    # If there are pending items, route only pending items as add-on; if all already confirmed, route all (reprint)
    pending_items = [it for it in order.items if it.status == "PENDING"]
    is_addon = (len(order.items) > len(pending_items)) and (len(pending_items) > 0)
    items_to_route = pending_items if pending_items else order.items
    ticket_order_num = f"{order.order_number}-ADDON" if is_addon else order.order_number

    if pending_items:
        for it in pending_items:
            it.status = "CONFIRMED"
        order.status = "CONFIRMED"
        db.commit()
        db.refresh(order)

    # Split into kitchen food vs bar drinks
    kitchen_items = [
        {
            "product_name": it.product.name if it.product else f"Item #{it.product_id}",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "notes": it.notes
        }
        for it in items_to_route
        if not is_bar_drink_item(it)
    ]
    bar_items = [
        {
            "product_name": it.product.name if it.product else f"Item #{it.product_id}",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "notes": it.notes
        }
        for it in items_to_route
        if is_bar_drink_item(it)
    ]

    results = []

    # 1. Food -> Kitchen KOT
    if kitchen_items:
        k_ip = cfg.get("kitchen_printer_ip", "192.168.0.70")
        k_port = int(cfg.get("kitchen_printer_port", 9100))
        k_win = cfg.get("kitchen_printer_windows_name", "KITCHEN KOT")
        kot_bytes = thermal_printer.build_kot_esc_pos(
            order_number=ticket_order_num,
            table_label=table_label,
            waiter_name=waiter_str,
            items=kitchen_items,
            dept="KITCHEN",
            created_at_str=created_str
        )
        k_ok, k_msg = await thermal_printer.print_bridge.dispatch_print(
            target="KITCHEN",
            ip=k_ip,
            port=k_port,
            windows_printer=k_win,
            data=kot_bytes,
            job_title=f"KOT {'Addon ' if is_addon else ''}#{order.order_number}"
        )
        results.append(f"Kitchen Food: {k_msg}")

    # 2. Drinks -> Posiflex Bar BOT
    if bar_items:
        bar_win = cfg.get("bar_printer_windows_name", "BAR BOT")
        bot_bytes = thermal_printer.build_kot_esc_pos(
            order_number=ticket_order_num,
            table_label=table_label,
            waiter_name=waiter_str,
            items=bar_items,
            dept="BAR",
            created_at_str=created_str
        )
        b_ok, b_msg = await thermal_printer.print_bridge.dispatch_print(
            target="BAR",
            windows_printer=bar_win,
            ip=cfg.get("bar_printer_ip", ""),
            port=int(cfg.get("bar_printer_port", 9100)),
            data=bot_bytes,
            job_title=f"BOT {'Addon ' if is_addon else ''}#{order.order_number}"
        )
        results.append(f"Bar Drinks: {b_msg}")

    # Fallback if no specific split
    if not kitchen_items and not bar_items and order.items:
        all_items = [
            {
                "product_name": it.product.name if it.product else f"Item #{it.product_id}",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "notes": it.notes
            }
            for it in order.items
        ]
        kot_bytes = thermal_printer.build_kot_esc_pos(
            order_number=order.order_number,
            table_label=table_label,
            waiter_name=waiter_str,
            items=all_items,
            dept="KITCHEN",
            created_at_str=created_str
        )
        k_ok, k_msg = await thermal_printer.print_bridge.dispatch_print(
            target="KITCHEN",
            ip=cfg.get("kitchen_printer_ip", "192.168.0.70"),
            port=int(cfg.get("kitchen_printer_port", 9100)),
            windows_printer=cfg.get("kitchen_printer_windows_name", "KITCHEN KOT"),
            data=kot_bytes,
            job_title=f"KOT #{order.order_number}"
        )
        results.append(f"KOT: {k_msg}")

    return {
        "success": True,
        "message": " & ".join(results) if results else "No items found in order to route.",
        "kitchen_count": len(kitchen_items),
        "bar_count": len(bar_items),
        "bridge_active": thermal_printer.print_bridge.is_connected()
    }
