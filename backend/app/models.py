from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class TableZone(Base):
    __tablename__ = "table_zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)  # standing, dining_4p, smoking_zone
    display_name = Column(String)
    prefix = Column(String)  # ST, DN, SZ
    description = Column(String, nullable=True)

    tables = relationship("PubTable", back_populates="zone")

class PubTable(Base):
    __tablename__ = "pub_tables"

    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(String, unique=True, index=True)  # ST-01, DN-04, SZ-02
    zone_id = Column(Integer, ForeignKey("table_zones.id"))
    capacity = Column(Integer, default=4)
    qr_token = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    current_status = Column(String, default="VACANT")  # VACANT, OCCUPIED, BILL_PENDING

    zone = relationship("TableZone", back_populates="tables")
    orders = relationship("Order", back_populates="table")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    target_dept = Column(String, default="KITCHEN")  # BAR, KITCHEN
    icon = Column(String, nullable=True)

    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    price = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    target_dept = Column(String, default="KITCHEN")  # BAR or KITCHEN
    is_available = Column(Boolean, default=True)
    image_url = Column(String, nullable=True)

    category = relationship("Category", back_populates="products")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("pub_tables.id"))
    order_number = Column(String, unique=True, index=True)
    customer_name = Column(String, nullable=True, default="Guest")
    status = Column(String, default="PENDING")  # PENDING, PREPARING, SERVED, BILLED, CANCELLED
    total_amount = Column(Float, default=0.0)
    payment_status = Column(String, default="PENDING")  # PENDING, COLLECTED
    payment_mode = Column(String, nullable=True)  # CASH, UPI, CARD
    amount_collected = Column(Float, nullable=True, default=0.0)
    collected_by = Column(String, nullable=True)  # Staff name or Waiter
    sync_status = Column(String, default="PENDING_SYNC")  # PENDING_SYNC, SYNCED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    table = relationship("PubTable", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)
    target_dept = Column(String, nullable=False)  # BAR or KITCHEN
    status = Column(String, default="PENDING")  # PENDING, PREPARING, READY, SERVED
    notes = Column(String, nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String)  # ORDER, MENU_UPDATE
    entity_id = Column(String)
    action = Column(String)  # CREATE, UPDATE
    sync_status = Column(String, default="PENDING")  # PENDING, SYNCED, FAILED
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="WAITER")  # ADMIN, WAITER, BAR_RECEPTION, KITCHEN_CHEF
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CustomerMember(Base):
    __tablename__ = "customer_members"

    id = Column(Integer, primary_key=True, index=True)
    member_code = Column(String, unique=True, index=True, nullable=False)  # e.g., BMC-1001 or QR Token
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)
    aadhar_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")  # ACTIVE, INACTIVE, VIP
    discount_percentage = Column(Float, default=0.0)
    visit_count = Column(Integer, default=1)
    total_spent = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MemberEntryLog(Base):
    __tablename__ = "member_entry_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("customer_members.id"))
    member_code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    status = Column(String, default="ACTIVE")
    visit_count = Column(Integer, default=1)
    entry_time = Column(DateTime, default=datetime.utcnow)


