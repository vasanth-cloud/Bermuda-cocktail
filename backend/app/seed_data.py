import hashlib
from sqlalchemy.orm import Session
from app.models import TableZone, PubTable, Category, Product, User

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def seed_initial_data(db: Session):
    # 0. Seed Users (Admin & Staff Accounts)
    if db.query(User).count() == 0:
        admin_user = User(
            name="Vasanth Admin",
            email="avasanth081@gmail.com",
            password_hash=hash_password("Vasanth@123"),
            role="ADMIN",
            allowed_terminals="customer,entry_scanner,bar,staff,members,admin",
            is_active=True
        )
        waiter_user = User(
            name="John Waiter",
            email="waiter@bermuda.pub",
            password_hash=hash_password("Waiter@123"),
            role="WAITER",
            allowed_terminals="customer,entry_scanner,staff,members",
            is_active=True
        )
        bar_user = User(
            name="Bar & Kitchen Staff",
            email="bar@bermuda.pub",
            password_hash=hash_password("Bar@123"),
            role="BAR_KITCHEN",
            allowed_terminals="customer,entry_scanner,bar,members",
            is_active=True
        )
        kitchen_user = User(
            name="Chef Mario",
            email="kitchen@bermuda.pub",
            password_hash=hash_password("Kitchen@123"),
            role="BAR_KITCHEN",
            allowed_terminals="customer,entry_scanner,bar,members",
            is_active=True
        )
        db.add_all([admin_user, waiter_user, bar_user, kitchen_user])
        db.commit()

    # 1. Seed Table Zones
    if db.query(TableZone).count() == 0:
        zones = [
            TableZone(name="standing", display_name="Standing Counter Tables", prefix="ST", description="Single standing tables near counter area"),
            TableZone(name="dining_4p", display_name="4-Seater Dining Tables", prefix="DN", description="4-member dining tables inside main hall"),
            TableZone(name="smoking_zone", display_name="Smoking Zone Tables", prefix="SZ", description="Outdoor & semi-covered smoking zone seating")
        ]
        db.add_all(zones)
        db.commit()

    # Fetch zones
    standing_zone = db.query(TableZone).filter_by(name="standing").first()
    dining_zone = db.query(TableZone).filter_by(name="dining_4p").first()
    smoking_zone = db.query(TableZone).filter_by(name="smoking_zone").first()

    # 2. Seed Pub Tables
    existing_count = db.query(PubTable).count()
    if existing_count < 49:
        existing_numbers = set(t.table_number for t in db.query(PubTable).all())
        tables_to_add = []

        # Pub Rounding Counter Tables C1 to C10
        for i in range(1, 11):
            t_num = f"C{i}"
            if t_num not in existing_numbers:
                tables_to_add.append(PubTable(
                    table_number=t_num,
                    zone_id=standing_zone.id,
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
                    zone_id=dining_zone.id,
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
                    zone_id=smoking_zone.id,
                    capacity=4,
                    qr_token=f"TOKEN_SZ_{i}",
                    current_status="VACANT"
                ))

        if tables_to_add:
            db.add_all(tables_to_add)
            db.commit()

    # 3. Seed Categories
    if db.query(Category).count() == 0:
        categories = [
            Category(name="Signature Cocktails", target_dept="BAR", icon="🍸"),
            Category(name="Mocktails & Coolers", target_dept="BAR", icon="🍹"),
            Category(name="Beers & Spirits", target_dept="BAR", icon="🍺"),
            Category(name="Bar Snacks & Finger Food", target_dept="KITCHEN", icon="🍟"),
            Category(name="Kitchen Starters & Mains", target_dept="KITCHEN", icon="🍔")
        ]
        db.add_all(categories)
        db.commit()

    # Fetch categories
    cocktails_cat = db.query(Category).filter_by(name="Signature Cocktails").first()
    mocktails_cat = db.query(Category).filter_by(name="Mocktails & Coolers").first()
    beers_cat = db.query(Category).filter_by(name="Beers & Spirits").first()
    snacks_cat = db.query(Category).filter_by(name="Bar Snacks & Finger Food").first()
    mains_cat = db.query(Category).filter_by(name="Kitchen Starters & Mains").first()

    # 4. Seed Products
    if db.query(Product).count() == 0:
        products = [
            # Bar - Cocktails
            Product(name="Bermuda Blue Lagoon", category_id=cocktails_cat.id, price=450.0, description="Blue Curacao, Vodka, Lemonade, Mint", target_dept="BAR"),
            Product(name="Smoked Old Fashioned", category_id=cocktails_cat.id, price=550.0, description="Bourbon, Angostura bitters, Orange peel", target_dept="BAR"),
            Product(name="Classic Mojito", category_id=cocktails_cat.id, price=380.0, description="White rum, fresh lime, mint leaves, soda", target_dept="BAR"),
            Product(name="Long Island Iced Tea (LIIT)", category_id=cocktails_cat.id, price=650.0, description="5 Spirits blend, Lemon juice, Cola", target_dept="BAR"),
            
            # Bar - Mocktails
            Product(name="Virgin Pina Colada", category_id=mocktails_cat.id, price=260.0, description="Pineapple juice, coconut cream, crushed ice", target_dept="BAR"),
            Product(name="Watermelon Mint Splash", category_id=mocktails_cat.id, price=240.0, description="Fresh watermelon, mint, lemon soda", target_dept="BAR"),

            # Bar - Beers & Spirits
            Product(name="Corona Extra (Bucket 330ml)", category_id=beers_cat.id, price=350.0, description="Chilled Mexican lager beer", target_dept="BAR"),
            Product(name="Draft Craft Beer (Pint)", category_id=beers_cat.id, price=290.0, description="Freshly brewed wheat beer on tap", target_dept="BAR"),

            # Kitchen - Bar Snacks
            Product(name="Loaded Cheese Nachos", category_id=snacks_cat.id, price=320.0, description="Crispy corn tortilla, melted cheddar, jalapenos & salsa", target_dept="KITCHEN"),
            Product(name="Crispy Chicken Wings (6pcs)", category_id=snacks_cat.id, price=390.0, description="Spicy BBQ glazed wings served with ranch", target_dept="KITCHEN"),
            Product(name="Truffle Parmesan Fries", category_id=snacks_cat.id, price=280.0, description="Skin-on fries tossed in white truffle oil & parmesan", target_dept="KITCHEN"),

            # Kitchen - Starters & Mains
            Product(name="Bermuda Club Burger", category_id=mains_cat.id, price=450.0, description="Smoked patty, caramelized onion, cheddar & house sauce", target_dept="KITCHEN"),
            Product(name="Peri-Peri Grilled Paneer Skewers", category_id=mains_cat.id, price=360.0, description="Cottage cheese cubes marinated in peri-peri glaze", target_dept="KITCHEN"),
            Product(name="Wood-fired Pepperoni Pizza", category_id=mains_cat.id, price=520.0, description="Mozzarella, spicy pepperoni, basil leaves", target_dept="KITCHEN")
        ]
        db.add_all(products)
        db.commit()
