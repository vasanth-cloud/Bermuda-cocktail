from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class TableZoneSchema(BaseModel):
    id: int
    name: str
    display_name: str
    prefix: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class PubTableSchema(BaseModel):
    id: int
    table_number: str
    zone_id: int
    capacity: int
    qr_token: str
    is_active: bool
    current_status: str
    zone: Optional[TableZoneSchema] = None

    class Config:
        from_attributes = True

class CategorySchema(BaseModel):
    id: int
    name: str
    target_dept: str
    icon: Optional[str] = None

    class Config:
        from_attributes = True

class ProductSchema(BaseModel):
    id: int
    name: str
    category_id: int
    price: float
    description: Optional[str] = None
    target_dept: str
    is_available: bool
    image_url: Optional[str] = None
    category: Optional[CategorySchema] = None

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    category_id: int
    price: float
    description: Optional[str] = None
    target_dept: str = "KITCHEN"
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    is_available: Optional[bool] = None
    target_dept: Optional[str] = None

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int
    notes: Optional[str] = None

class OrderCreate(BaseModel):
    table_id: int
    customer_name: Optional[str] = "Guest"
    items: List[CartItemCreate]

class OrderItemSchema(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    target_dept: str
    status: str
    notes: Optional[str] = None
    product: Optional[ProductSchema] = None

    class Config:
        from_attributes = True

class OrderSchema(BaseModel):
    id: int
    table_id: int
    order_number: str
    customer_name: str
    status: str
    total_amount: float
    payment_status: Optional[str] = "PENDING"
    payment_mode: Optional[str] = None
    amount_collected: Optional[float] = 0.0
    collected_by: Optional[str] = None
    sync_status: str
    created_at: datetime
    table: Optional[PubTableSchema] = None
    items: List[OrderItemSchema] = []

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: str

class ItemStatusUpdate(BaseModel):
    status: str

class PaymentCollectRequest(BaseModel):
    payment_mode: str  # CASH, UPI, CARD
    amount_collected: float
    collected_by: Optional[str] = "Waiter / Cashier"

class AddItemsToOrderRequest(BaseModel):
    items: List[CartItemCreate]
    waiter_name: Optional[str] = "Waiter"

class UserSchema(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "WAITER"  # ADMIN, WAITER, BAR_RECEPTION, KITCHEN_CHEF

class UserLogin(BaseModel):
    email: str
    password: str
