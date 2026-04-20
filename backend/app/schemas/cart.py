import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CartItemIn(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., ge=1, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1, le=999)


class CartItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    product_image_url: str | None = None
    product_stock: int
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class CartOut(BaseModel):
    id: uuid.UUID
    items: list[CartItemOut]
    total: Decimal
