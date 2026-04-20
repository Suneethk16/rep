import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import UserRole


class AdminStatsOut(BaseModel):
    total_users: int
    total_products: int
    total_orders: int
    total_revenue: Decimal


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None


class UploadOut(BaseModel):
    url: str
