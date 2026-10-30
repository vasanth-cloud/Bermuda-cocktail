import json
import os
import secrets
from sqlalchemy.orm import Session
from app.models import TableZone, PubTable, Category, Product, User, Order
from app.security import hash_password

STAFF_USERS_JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "staff_users.json"))

def seed_initial_data(db: Session):
    # 0. Sync & Seed Users (Admin & Staff Accounts)
    # Ensure Master Admin ALWAYS exists with full access
    admin_user = db.query(User).filter(User.email.ilike("avasanth081@gmail.com")).first()
    if not admin_user:
        admin_pass = os.getenv("ADMIN_INITIAL_PASSWORD", "Vasanth@123")
        admin_user = User(
            name="Vasanth Admin",
            email="avasanth081@gmail.com",
            password_hash=hash_password(admin_pass),
            role="ADMIN",
            allowed_terminals="customer,entry_scanner,bar,staff,reports,tables,staff_accounts,members,admin",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
    else:
        # Guarantee admin privileges are up-to-date
        if "staff_accounts" not in (admin_user.allowed_terminals or ""):
            admin_user.allowed_terminals = "customer,entry_scanner,bar,staff,reports,tables,staff_accounts,members,admin"
            admin_user.role = "ADMIN"
            admin_user.is_active = True
            db.commit()

    # CRITICAL: ONLY seed initial starter staff if database is completely brand new (count <= 1).
    # NEVER re-insert staff accounts that an administrator has deleted!
    total_users_count = db.query(User).count()
    if total_users_count <= 1:
        # Check if a persistent backup exists in staff_users.json
        seeded_staff = False
        if os.path.exists(STAFF_USERS_JSON_PATH):
            try:
                with open(STAFF_USERS_JSON_PATH, "r", encoding="utf-8") as f:
                    saved_users = json.load(f)
                    for u in saved_users:
                        if u.get("email", "").lower() != "avasanth081@gmail.com":
                            existing = db.query(User).filter(User.email.ilike(u["email"])).first()
                            if not existing:
                                p_hash = u.get("password_hash")
                                if not p_hash or not (p_hash.startswith("$2b$") or len(p_hash) == 64):
                                    p_hash = hash_password(secrets.token_urlsafe(16))
                                db.add(User(
                                    name=u["name"],
                                    email=u["email"],
                                    password_hash=p_hash,
                                    role=u.get("role", "WAITER"),
                                    allowed_terminals=u.get("allowed_terminals", "customer,staff"),
                                    is_active=u.get("is_active", True)
                                ))
                                seeded_staff = True
                    if seeded_staff:
                        db.commit()
            except Exception as e:
                print(f"[seed_data] Warning reading staff_users.json: {e}")

        # If still only master admin exists, seed standard initial accounts for first run only
        if not seeded_staff and db.query(User).count() <= 1:
            starter_accounts = [
                {"name": "PADMESH", "email": "padmeshskmr@gmail.com", "password": "Padmesh@123", "role": "WAITER", "allowed_terminals": "staff"}
            ]
            for u in starter_accounts:
                existing = db.query(User).filter(User.email.ilike(u["email"])).first()
                if not existing:
                    db.add(User(
                        name=u["name"],
                        email=u["email"],
                        password_hash=hash_password(u["password"]),
                        role=u["role"],
                        allowed_terminals=u["allowed_terminals"],
                        is_active=True
                    ))
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
