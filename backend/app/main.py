from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
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


# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bermuda Cocktail Pub POS & Order System", version="1.0.0")

# Setup uploads directory for custom product image uploads
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Support Cloud & Custom Domain CORS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
origins_list = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins_list else origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# --- WebSocket Endpoint ---
@app.websocket("/ws-api/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
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

import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

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
@app.post("/api/auth/login")
def login_user(creds: schemas.UserLogin, db: Session = Depends(get_db)):
    hashed = hash_password(creds.password)
    user = db.query(models.User).filter(
        models.User.email == creds.email,
        models.User.password_hash == hashed
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    allowed = user.allowed_terminals
    if not allowed:
        if user.role == "ADMIN" or user.email == "avasanth081@gmail.com":
            allowed = "customer,entry_scanner,bar,staff,members,admin"
        elif user.role in ["BAR_RECEPTION", "KITCHEN_CHEF", "BAR_KITCHEN"]:
            allowed = "customer,entry_scanner,bar,members"
        else:
            allowed = "customer,entry_scanner,staff,members"

    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "allowed_terminals": allowed
        }
    }

@app.get("/api/users", response_model=List[schemas.UserSchema])
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@app.post("/api/users", response_model=schemas.UserSchema)
def create_staff_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    terminals = user_data.allowed_terminals
    if not terminals:
        if user_data.role.upper() == "ADMIN":
            terminals = "customer,entry_scanner,bar,staff,members,admin"
        else:
            terminals = "customer,staff"

    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
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
def update_staff_user(user_id: int, user_data: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.name is not None:
        user.name = user_data.name
    if user_data.email is not None and user_data.email.strip():
        if user_data.email != user.email:
            existing = db.query(models.User).filter(models.User.email == user_data.email).first()
            if existing:
                raise HTTPException(status_code=400, detail="User with this email already exists")
            user.email = user_data.email
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
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email == "avasanth081@gmail.com":
        raise HTTPException(status_code=400, detail="Cannot delete master admin account")

    db.delete(user)
    db.commit()
    sync_staff_users_to_file(db)
    return {"message": "User deleted successfully"}

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
async def create_table(table_data: schemas.PubTableCreate, db: Session = Depends(get_db)):
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
async def update_table(table_id: int, table_update: schemas.PubTableUpdate, db: Session = Depends(get_db)):
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
async def delete_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.PubTable).filter(models.PubTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    db.delete(table)
    db.commit()
    await manager.broadcast_all({"event": "TABLE_STATUS_UPDATED", "table_id": table_id, "deleted": True})
    return {"message": "Table deleted successfully"}

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
async def create_product(prod_data: schemas.ProductCreate, db: Session = Depends(get_db)):
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
async def update_product(product_id: int, prod_update: schemas.ProductUpdate, db: Session = Depends(get_db)):
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

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    ext = os.path.splitext(file.filename)[1]
    if not ext:
        ext = ".png"
    filename = f"img_{uuid.uuid4().hex[:10]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"image_url": f"/uploads/{filename}"}

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()

    await manager.broadcast_all({"event": "MENU_UPDATED"})
    return {"message": "Product deleted successfully"}

@app.post("/api/menu/import-excel")
async def trigger_excel_menu_import(db: Session = Depends(get_db)):
    from app.excel_importer import import_excel_menu
    success = import_excel_menu(db)
    if success:
        await manager.broadcast_all({"event": "MENU_UPDATED"})
        return {"message": "Menu successfully re-imported and updated from Excel price list!"}
    else:
        raise HTTPException(status_code=500, detail="Failed to import menu from Excel file.")

# --- Order & Split Routing Endpoints ---
@app.post("/api/orders", response_model=schemas.OrderSchema)
async def create_order(order_data: schemas.OrderCreate, db: Session = Depends(get_db)):
    table = db.query(models.PubTable).filter(models.PubTable.id == order_data.table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

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
            if dto.status in ["PENDING", "PENDING_WAITER", "BILLED"]:
                continue
            dept_items = [it for it in dto.items if (it.target_dept or "").upper() == target_dept_upper]
            if dept_items:
                dto.items = dept_items
                filtered_orders.append(dto)
        return filtered_orders

    return dtos

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: int, status_update: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
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

@app.post("/api/orders/{order_id}/waiter-confirm")
async def waiter_confirm_order(order_id: int, waiter_name: Optional[str] = "Waiter", db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = "CONFIRMED"
    order.waiter_name = waiter_name
    if not order.collected_by:
        order.collected_by = waiter_name

    for item in order.items:
        if item.status == "PENDING":
            item.status = "CONFIRMED"
        # Accurately classify department in DB
        item.target_dept = "BAR" if is_bar_drink_item(item) else "KITCHEN"

    db.commit()
    db.refresh(order)

    # Split order items into Bar Drinks and Kitchen Food
    bar_items = [it for it in order.items if is_bar_drink_item(it)]
    kitchen_items = [it for it in order.items if not is_bar_drink_item(it)]

    bar_items_count = len(bar_items)
    kitchen_items_count = len(kitchen_items)

    order_payload = {
        "event": "WAITER_CONFIRMED_ORDER",
        "order_id": order.id,
        "order_number": order.order_number,
        "table_number": order.table.table_number if order.table else "ST-01",
        "zone_name": order.table.zone.display_name if order.table and order.table.zone else "Main Zone",
        "customer_name": order.customer_name,
        "total_amount": order.total_amount,
        "status": order.status,
        "confirmed_by": waiter_name,
        "waiter_name": waiter_name,
        "bar_items_count": bar_items_count,
        "kitchen_items_count": kitchen_items_count,
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
                        order_number=order.order_number,
                        table_label=full_tbl,
                        waiter_name=waiter_name or "Staff",
                        items=k_items_data,
                        dept="KITCHEN"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="KITCHEN",
                        ip=k_ip,
                        port=k_port,
                        windows_printer=k_win,
                        data=kot_data,
                        job_title=f"KOT #{order.order_number}"
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
                        order_number=order.order_number,
                        table_label=full_tbl,
                        waiter_name=waiter_name or "Staff",
                        items=b_items_data,
                        dept="BAR"
                    )
                    await thermal_printer.print_bridge.dispatch_print(
                        target="BAR",
                        windows_printer=bar_win,
                        ip=printer_cfg.get("bar_printer_ip", ""),
                        port=int(printer_cfg.get("bar_printer_port", 9100)),
                        data=bot_data,
                        job_title=f"BOT #{order.order_number}"
                    )
                except Exception as ex:
                    print(f"[AutoPrintBarBOT] Error: {ex}")
            asyncio.create_task(_auto_print_bar_job())

    await manager.broadcast_all(order_payload)
    return {
        "message": f"Order #{order.order_number} confirmed by {waiter_name} and routed: {kitchen_items_count} food items to Kitchen KOT, {bar_items_count} drinks items to Posiflex Bar",
        "order": order_payload
    }

@app.post("/api/orders/{order_id}/add-items")
async def add_items_to_order(order_id: int, req: schemas.AddItemsToOrderRequest, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

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

    # Auto-dispatch supplemental Food KOT to Kitchen LAN printer if kitchen items were added
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

    # Auto-dispatch supplemental Drinks BOT to Posiflex USB if bar items were added
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

@app.delete("/api/order-items/{item_id}")
async def delete_order_item(item_id: int, db: Session = Depends(get_db)):
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
async def update_item_status(item_id: int, status_update: schemas.ItemStatusUpdate, db: Session = Depends(get_db)):
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

@app.post("/api/orders/{order_id}/collect-payment")
async def collect_order_payment(order_id: int, req: schemas.PaymentCollectRequest, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.payment_status = "COLLECTED"
    order.payment_mode = req.payment_mode
    order.amount_collected = req.amount_collected
    order.collected_by = req.collected_by or "Waiter"
    order.booking_platform = req.booking_platform or "Direct / Walk-in"
    order.booking_reference_id = req.booking_reference_id or None
    order.discount_percentage = req.discount_percentage or 0.0
    order.discount_amount = req.discount_amount or 0.0
    order.final_amount = req.final_amount or req.amount_collected
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
                    "total_amount": order.total_amount,
                    "discount_percentage": order.discount_percentage or 0.0,
                    "discount_amount": order.discount_amount or 0.0,
                    "final_amount": order.final_amount or order.amount_collected or order.total_amount,
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
def get_payment_logs(db: Session = Depends(get_db)):
    collected_orders = db.query(models.Order).filter(
        models.Order.payment_status == "COLLECTED"
    ).order_by(models.Order.updated_at.desc()).all()

    logs = []
    total_cash = 0.0
    total_upi = 0.0
    total_card = 0.0
    total_discount_given = 0.0
    platform_counts = {}

    for ord in collected_orders:
        amt = ord.amount_collected or ord.final_amount or ord.total_amount
        mode = ord.payment_mode or "CASH"
        platform = ord.booking_platform or "Direct / Walk-in"
        disc_pct = ord.discount_percentage or 0.0
        disc_amt = ord.discount_amount or 0.0

        if mode == "CASH":
            total_cash += amt
        elif mode == "UPI":
            total_upi += amt
        elif mode == "CARD":
            total_card += amt

        total_discount_given += disc_amt
        platform_counts[platform] = platform_counts.get(platform, 0) + 1

        logs.append({
            "order_id": ord.id,
            "order_number": ord.order_number,
            "table_number": ord.table.table_number if ord.table else "ST-01",
            "zone_name": ord.table.zone.display_name if ord.table and ord.table.zone else "Main Zone",
            "amount_collected": amt,
            "subtotal_amount": ord.total_amount,
            "payment_mode": mode,
            "booking_platform": platform,
            "booking_reference_id": ord.booking_reference_id or "-",
            "discount_percentage": disc_pct,
            "discount_amount": disc_amt,
            "collected_by": ord.collected_by or "Staff",
            "timestamp": ord.updated_at.strftime("%d-%m-%Y %H:%M:%S") if ord.updated_at else ord.created_at.strftime("%d-%m-%Y %H:%M:%S")
        })

    return {
        "summary": {
            "total_cash": total_cash,
            "total_upi": total_upi,
            "total_card": total_card,
            "grand_total": total_cash + total_upi + total_card,
            "total_discount_given": total_discount_given,
            "total_transactions": len(logs),
            "platform_breakdown": platform_counts
        },
        "logs": logs
    }

@app.delete("/api/payments/log/{order_id}")
async def delete_single_payment_log(order_id: int, db: Session = Depends(get_db)):
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
async def clear_all_payment_logs(db: Session = Depends(get_db)):
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
async def settle_table_bill(table_id: int, db: Session = Depends(get_db)):
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
def get_category_sales_report(db: Session = Depends(get_db)):
    collected_orders = db.query(models.Order).filter(models.Order.payment_status == "COLLECTED").all()

    total_cash = 0.0
    total_upi = 0.0
    total_card = 0.0
    grand_total_collected = 0.0
    total_discounts = 0.0

    dept_breakdown = {
        "KITCHEN": {"items_sold": 0, "gross_sales": 0.0, "name": "Food & Kitchen"},
        "BAR": {"items_sold": 0, "gross_sales": 0.0, "name": "Bar Drinks & Liquor"}
    }

    category_sales = {}
    platform_sales = {}

    for ord in collected_orders:
        amt = ord.amount_collected or ord.final_amount or ord.total_amount or 0.0
        mode = ord.payment_mode or "CASH"
        platform = ord.booking_platform or "Direct / Walk-in"
        disc = ord.discount_amount or 0.0

        if mode == "CASH":
            total_cash += amt
        elif mode == "UPI":
            total_upi += amt
        elif mode == "CARD":
            total_card += amt

        grand_total_collected += amt
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
            "grand_total": grand_total_collected,
            "total_discounts": total_discounts,
            "total_orders": len(collected_orders)
        },
        "department_summary": dept_breakdown,
        "category_sales": sorted_category_list,
        "platform_sales": platform_sales
    }

# --- Sync Simulation Endpoints ---
@app.get("/api/sync/status")
def get_sync_status(db: Session = Depends(get_db)):
    pending_count = db.query(models.SyncLog).filter(models.SyncLog.sync_status == "PENDING").count()
    synced_count = db.query(models.SyncLog).filter(models.SyncLog.sync_status == "SYNCED").count()
    return {
        "pending_sync_count": pending_count,
        "synced_count": synced_count,
        "connection_mode": "OFFLINE_LOCAL_SERVER",
        "cloud_status": "READY_FOR_SYNC"
    }

@app.post("/api/sync/trigger")
def trigger_cloud_sync(db: Session = Depends(get_db)):
    pending_logs = db.query(models.SyncLog).filter(models.SyncLog.sync_status == "PENDING").all()
    count = len(pending_logs)
    for log in pending_logs:
        log.sync_status = "SYNCED"
        log.synced_at = models.datetime.utcnow()
    db.commit()
    return {"message": f"Successfully synced {count} transactions to Cloud Admin Panel"}

# --- Member Card Management Endpoints ---
@app.get("/api/members", response_model=List[schemas.CustomerMemberSchema])
def get_members(q: Optional[str] = None, db: Session = Depends(get_db)):
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
def create_member(member_data: schemas.CustomerMemberCreate, db: Session = Depends(get_db)):
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
def get_member_by_code(member_identifier: str, db: Session = Depends(get_db)):
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
def update_member(member_id: int, update_data: schemas.CustomerMemberUpdate, db: Session = Depends(get_db)):
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

@app.delete("/api/members/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.CustomerMember).filter(models.CustomerMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
    return {"message": "Member card deleted successfully"}

@app.post("/api/members/{member_id}/record-visit")
def record_member_visit(member_id: int, db: Session = Depends(get_db)):
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

@app.get("/api/members/entry-logs", response_model=List[schemas.MemberEntryLogSchema])
def get_member_entry_logs(db: Session = Depends(get_db)):
    return db.query(models.MemberEntryLog).order_by(models.MemberEntryLog.entry_time.desc()).all()

@app.delete("/api/members/entry-logs")
def clear_member_entry_logs(db: Session = Depends(get_db)):
    count = db.query(models.MemberEntryLog).delete()
    db.commit()
    return {"message": f"Successfully cleared {count} member entry log records"}

@app.post("/api/members/bulk-import")
def bulk_import_members(members_list: List[schemas.CustomerMemberCreate], db: Session = Depends(get_db)):
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

# --- Thermal Printer Management & ESC/POS Endpoints ---

@app.get("/api/printers/config")
def get_printer_configuration():
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
def update_printer_configuration(config_data: dict):
    saved = thermal_printer.save_printer_config(config_data)
    saved["bridge_connected"] = thermal_printer.print_bridge.is_connected()
    saved["connected_bridges"] = thermal_printer.print_bridge.get_connected_bridges()
    return {"message": "Printer configuration saved successfully", "config": saved}

@app.post("/api/printers/discover")
async def discover_lan_printers():
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
async def test_printer_connection(req: dict = {}):
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
async def print_order_kot(order_id: int, req: dict = {}, db: Session = Depends(get_db)):
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
async def print_order_bot(order_id: int, req: dict = {}, db: Session = Depends(get_db)):
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
async def print_order_bill(order_id: int, req: dict = {}, db: Session = Depends(get_db)):
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
        "total_amount": order.total_amount,
        "discount_percentage": order.discount_percentage or 0.0,
        "discount_amount": order.discount_amount or 0.0,
        "final_amount": order.final_amount or order.amount_collected or order.total_amount,
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
async def auto_route_order_kots(order_id: int, req: dict = {}, db: Session = Depends(get_db)):
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

    # Split into kitchen food vs bar drinks
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

    results = []

    # 1. Food -> Kitchen KOT
    if kitchen_items:
        k_ip = cfg.get("kitchen_printer_ip", "192.168.0.70")
        k_port = int(cfg.get("kitchen_printer_port", 9100))
        k_win = cfg.get("kitchen_printer_windows_name", "KITCHEN KOT")
        kot_bytes = thermal_printer.build_kot_esc_pos(
            order_number=order.order_number,
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
            job_title=f"KOT #{order.order_number}"
        )
        results.append(f"Kitchen Food: {k_msg}")

    # 2. Drinks -> Posiflex Bar BOT
    if bar_items:
        bar_win = cfg.get("bar_printer_windows_name", "BAR BOT")
        bot_bytes = thermal_printer.build_kot_esc_pos(
            order_number=order.order_number,
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
            job_title=f"BOT #{order.order_number}"
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
