import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


class PaymentIntentCreate(BaseModel):
    address_id: uuid.UUID


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: Decimal
    currency: str


class OrderCreate(BaseModel):
    # One of the two must be supplied. `address_id` refers to a saved Address
    # on the current user; `shipping_address` is a raw freeform fallback
    # (kept for backward compatibility with pre-address-feature clients).
    address_id: uuid.UUID | None = None
    shipping_address: str | None = Field(default=None, min_length=5, max_length=1024)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    unit_price: Decimal
    quantity: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    status: OrderStatus
    payment_status: str
    total: Decimal
    shipping_address: str
    address_id: uuid.UUID | None
    stripe_payment_intent_id: str | None
    items: list[OrderItemOut]
    created_at: datetime
    updated_at: datetime
