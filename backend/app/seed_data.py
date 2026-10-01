import hashlib
import json
import os
from sqlalchemy.orm import Session
from app.models import TableZone, PubTable, Category, Product, User, Order

STAFF_USERS_JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "staff_users.json"))

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def seed_initial_data(db: Session):
    # 0. Sync & Seed Users (Admin & Staff Accounts)
    # Ensure all defined staff accounts exist and persist across deploys/restarts
    users_to_sync = []
    if os.path.exists(STAFF_USERS_JSON_PATH):
        try:
            with open(STAFF_USERS_JSON_PATH, "r", encoding="utf-8") as f:
                users_to_sync = json.load(f)
        except Exception as e:
            print(f"[seed_data] Warning loading staff_users.json: {e}")

    if not users_to_sync:
        users_to_sync = [
            {"name": "Vasanth Admin", "email": "avasanth081@gmail.com", "password": "Vasanth@123", "role": "ADMIN", "allowed_terminals": "customer,entry_scanner,bar,staff,members,admin"},
            {"name": "padmesh", "email": "padmeshskmr@gmail.com", "password_hash": "99a96506f91a60e57d7cae1aa3d4f794cdee1f7ef621fb521efded8479b9a4da", "role": "BAR_KITCHEN", "allowed_terminals": "customer,bar,staff,members"},
            {"name": "surendar", "email": "surendar@gmail.com", "password_hash": "840979de0c216277cf7d1805bd4f309a6d82ac29ee94b7087d30fd79c36beb95", "role": "WAITER", "allowed_terminals": "customer,staff,members"},
            {"name": "Ajaykumar", "email": "ajaykumar@bermuda.pub", "password": "Ajay@123", "role": "WAITER", "allowed_terminals": "customer,staff,members"},
            {"name": "John Waiter", "email": "waiter@bermuda.pub", "password": "Waiter@123", "role": "WAITER", "allowed_terminals": "customer,entry_scanner,staff,members"},
            {"name": "Bar & Kitchen Staff", "email": "bar@bermuda.pub", "password": "Bar@123", "role": "BAR_KITCHEN", "allowed_terminals": "customer,entry_scanner,bar,members"},
            {"name": "Chef Mario", "email": "kitchen@bermuda.pub", "password": "Kitchen@123", "role": "BAR_KITCHEN", "allowed_terminals": "customer,entry_scanner,bar,members"}
        ]

    for u_info in users_to_sync:
        existing = db.query(User).filter_by(email=u_info["email"]).first()
        if not existing:
            p_hash = u_info.get("password_hash") or hash_password(u_info.get("password", "Bermuda@123"))
            new_u = User(
                name=u_info["name"],
                email=u_info["email"],
                password_hash=p_hash,
                role=u_info.get("role", "WAITER"),
                allowed_terminals=u_info.get("allowed_terminals", "customer,staff"),
                is_active=u_info.get("is_active", True)
            )
            db.add(new_u)
        else:
            if not existing.allowed_terminals and u_info.get("allowed_terminals"):
                existing.allowed_terminals = u_info["allowed_terminals"]
    db.commit()

    # 1. Seed & Update Table Zones
    if db.query(TableZone).count() == 0:
        zones = [
            TableZone(name="standing", display_name="Pub Rounding", prefix="C", description="Pub Rounding Tables C1 to C10"),
            TableZone(name="dining_4p", display_name="Dining", prefix="DN", description="Dining Tables DN-1 to DN-29"),
            TableZone(name="smoking_zone", display_name="Smoking area", prefix="SZ", description="Smoking Zone Tables SZ-1 to SZ-10")
        ]
        db.add_all(zones)
        db.commit()
    else:
        # Update zone display names if they exist
        standing_z = db.query(TableZone).filter_by(name="standing").first()
        if standing_z:
            standing_z.display_name = "Pub Rounding"
            standing_z.prefix = "C"
        dining_z = db.query(TableZone).filter_by(name="dining_4p").first()
        if dining_z:
            dining_z.display_name = "Dining"
            dining_z.prefix = "DN"
        smoking_z = db.query(TableZone).filter_by(name="smoking_zone").first()
        if smoking_z:
            smoking_z.display_name = "Smoking area"
            smoking_z.prefix = "SZ"
        db.commit()

    # Fetch zones
    standing_zone = db.query(TableZone).filter_by(name="standing").first()
    dining_zone = db.query(TableZone).filter_by(name="dining_4p").first()
    smoking_zone = db.query(TableZone).filter_by(name="smoking_zone").first()

    # 2. Cleanup Legacy Tables & Seed Exact 49 Pub Tables
    valid_numbers = set([f"C{i}" for i in range(1, 11)] + [f"DN-{i}" for i in range(1, 30)] + [f"SZ-{i}" for i in range(1, 11)])
    
    # Delete legacy tables not in the 49 valid pub table numbers safely
    try:
        legacy_tables = db.query(PubTable).filter(~PubTable.table_number.in_(valid_numbers)).all()
        if legacy_tables:
            fallback_table = db.query(PubTable).filter(PubTable.table_number.in_(valid_numbers)).first()
            for leg_table in legacy_tables:
                orders_for_table = db.query(Order).filter(Order.table_id == leg_table.id).all()
                for ord_obj in orders_for_table:
                    if fallback_table:
                        ord_obj.table_id = fallback_table.id
                    else:
                        db.delete(ord_obj)
                db.delete(leg_table)
            db.commit()
    except Exception as err:
        db.rollback()
        print(f"[seed_data] Warning: Legacy table cleanup handled: {err}")

    existing_numbers = set(t.table_number for t in db.query(PubTable).all())
    tables_to_add = []

    # Pub Rounding Counter Tables C1 to C10
    for i in range(1, 11):
        t_num = f"C{i}"
        if t_num not in existing_numbers:
            tables_to_add.append(PubTable(
                table_number=t_num,
                zone_id=standing_zone.id if standing_zone else None,
                capacity=2,
                qr_token=f"TOKEN_{t_num}",
                current_status="VACANT"
            ))

    # Dining Tables DN-1 to DN-29
    for i in range(1, 30):
        t_num = f"DN-{i}"
        if t_num not in existing_numbers:
            tables_to_add.append(PubTable(
                table_number=t_num,
                zone_id=dining_zone.id if dining_zone else None,
                capacity=4,
                qr_token=f"TOKEN_DN_{i}",
                current_status="VACANT"
            ))

    # Smoking Zone Tables SZ-1 to SZ-10
    for i in range(1, 11):
        t_num = f"SZ-{i}"
        if t_num not in existing_numbers:
            tables_to_add.append(PubTable(
                table_number=t_num,
                zone_id=smoking_zone.id if smoking_zone else None,
                capacity=4,
                qr_token=f"TOKEN_SZ_{i}",
                current_status="VACANT"
            ))

    if tables_to_add:
        db.add_all(tables_to_add)
        db.commit()

    # 3. Seed Categories & Products from Excel Price List
    if db.query(Category).count() < 30 or db.query(Product).count() < 50:
        try:
            from app.excel_importer import import_excel_menu
            import_excel_menu(db)
        except Exception as e:
            print(f"[seed_data] Warning: Excel menu import encountered an issue: {e}")
