import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CategoryIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=140, pattern=r"^[a-z0-9-]+$")


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class ProductIn(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    price: Decimal = Field(..., ge=Decimal("0.01"), decimal_places=2)
    stock: int = Field(0, ge=0)
    stock_unit: str = Field("qty", pattern=r"^(qty|kg)$")
    image_url: str | None = Field(default=None, max_length=1024)
    category_id: uuid.UUID | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=Decimal("0.01"), decimal_places=2)
    stock: int | None = Field(default=None, ge=0)
    stock_unit: str | None = Field(default=None, pattern=r"^(qty|kg)$")
    image_url: str | None = Field(default=None, max_length=1024)
    category_id: uuid.UUID | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    name: str
    description: str
    price: Decimal
    stock: int
    stock_unit: str
    image_url: str | None
    category_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    size: int
