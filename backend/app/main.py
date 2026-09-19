from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.database import engine, Base, get_db
from app import models, schemas
from app.seed_data import seed_initial_data
from app.services.order_router import manager

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed database on startup
db_session = Depends(get_db)

import os

app = FastAPI(title="Bermuda Cocktail Pub POS & Order System", version="1.0.0")

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
                "waiter_name": "ALTER TABLE orders ADD COLUMN waiter_name VARCHAR"
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

    if prod_update.name is not None:
        product.name = prod_update.name
    if prod_update.category_id is not None:
        product.category_id = prod_update.category_id
    if prod_update.price is not None:
        product.price = prod_update.price
    if prod_update.description is not None:
        product.description = prod_update.description
    if prod_update.is_available is not None:
        product.is_available = prod_update.is_available
    if prod_update.target_dept is not None:
        product.target_dept = prod_update.target_dept

    db.commit()
    db.refresh(product)

    await manager.broadcast_all({"event": "MENU_UPDATED"})
    return product

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()

    await manager.broadcast_all({"event": "MENU_UPDATED"})
    return {"message": "Product deleted successfully"}

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

        order_item = models.OrderItem(
            order_id=new_order.id,
            product_id=prod.id,
            quantity=item.quantity,
            unit_price=prod.price,
            target_dept=prod.target_dept,
            status="PENDING",
            notes=item.notes
        )
        db.add(order_item)

        if prod.target_dept == "BAR":
            bar_items_added += 1
        elif prod.target_dept == "KITCHEN":
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
    if bar_items_added > 0:
        await manager.broadcast_to_channel("bar", {**order_payload, "dept_filter": "BAR"})
    if kitchen_items_added > 0:
        await manager.broadcast_to_channel("kitchen", {**order_payload, "dept_filter": "KITCHEN"})
    
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

    # Filter items if target_dept specified
    if target_dept:
        filtered_orders = []
        target_dept_upper = target_dept.upper()
        for ord in orders:
            if ord.status == "BILLED":
                continue
            dept_items = [it for it in ord.items if (it.target_dept or "").upper() == target_dept_upper]
            if dept_items:
                # Clone order object with filtered items for response
                ord.items = dept_items
                filtered_orders.append(ord)
        return filtered_orders

    return orders

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

    db.commit()
    db.refresh(order)

    bar_items_count = sum(1 for it in order.items if it.target_dept == "BAR")
    kitchen_items_count = sum(1 for it in order.items if it.target_dept == "KITCHEN")

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
                "target_dept": it.target_dept,
                "status": it.status,
                "notes": it.notes
            }
            for it in order.items
        ]
    }

    # Route split orders to Bar Reception & Kitchen KDS / KOT machine
    if bar_items_count > 0:
        await manager.broadcast_to_channel("bar", {**order_payload, "dept_filter": "BAR"})
    if kitchen_items_count > 0:
        await manager.broadcast_to_channel("kitchen", {**order_payload, "dept_filter": "KITCHEN", "trigger_kot_print": True})
    
    await manager.broadcast_all(order_payload)
    return {"message": "Order confirmed by Waiter and routed to Reception Bar & Kitchen KOT", "order": order_payload}

@app.post("/api/orders/{order_id}/add-items")
async def add_items_to_order(order_id: int, req: schemas.AddItemsToOrderRequest, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    added_total = 0.0
    for item in req.items:
        prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not prod:
            continue

        item_price = prod.price * item.quantity
        added_total += item_price

        order_item = models.OrderItem(
            order_id=order.id,
            product_id=prod.id,
            quantity=item.quantity,
            unit_price=prod.price,
            target_dept=prod.target_dept,
            status="PENDING",
            notes=item.notes
        )
        db.add(order_item)

    order.total_amount += added_total
    db.commit()
    db.refresh(order)

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
    order.status = "BILLED"

    if order.table:
        order.table.current_status = "VACANT"

    db.commit()

    event_payload = {
        "event": "PAYMENT_COLLECTED",
        "order_id": order.id,
        "order_number": order.order_number,
        "table_number": order.table.table_number if order.table else "ST-01",
        "payment_mode": order.payment_mode,
        "amount_collected": order.amount_collected,
        "collected_by": order.collected_by
    }
    await manager.broadcast_all(event_payload)
    return {"message": f"Payment of ₹{order.amount_collected} collected via {order.payment_mode}", "order_id": order.id}

@app.get("/api/payments/log")
def get_payment_logs(db: Session = Depends(get_db)):
    collected_orders = db.query(models.Order).filter(
        models.Order.payment_status == "COLLECTED"
    ).order_by(models.Order.updated_at.desc()).all()

    logs = []
    total_cash = 0.0
    total_upi = 0.0
    total_card = 0.0

    for ord in collected_orders:
        amt = ord.amount_collected or ord.total_amount
        mode = ord.payment_mode or "CASH"
        if mode == "CASH":
            total_cash += amt
        elif mode == "UPI":
            total_upi += amt
        elif mode == "CARD":
            total_card += amt

        logs.append({
            "order_id": ord.id,
            "order_number": ord.order_number,
            "table_number": ord.table.table_number if ord.table else "ST-01",
            "zone_name": ord.table.zone.display_name if ord.table and ord.table.zone else "Main Zone",
            "amount_collected": amt,
            "payment_mode": mode,
            "collected_by": ord.collected_by or "Staff",
            "timestamp": ord.updated_at.strftime("%d-%m-%Y %H:%M:%S") if ord.updated_at else ord.created_at.strftime("%d-%m-%Y %H:%M:%S")
        })

    return {
        "summary": {
            "total_cash": total_cash,
            "total_upi": total_upi,
            "total_card": total_card,
            "grand_total": total_cash + total_upi + total_card,
            "total_transactions": len(logs)
        },
        "logs": logs
    }

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



