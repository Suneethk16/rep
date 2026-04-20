import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.models.user import User, UserRole
from app.schemas.admin import AdminStatsOut, AdminUserUpdate


# Orders in these states represent realized revenue.
REVENUE_STATUSES = (OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED)


class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def stats(self) -> AdminStatsOut:
        total_users = (await self.db.scalar(select(func.count()).select_from(User))) or 0
        total_products = (
            await self.db.scalar(select(func.count()).select_from(Product))
        ) or 0
        total_orders = (
            await self.db.scalar(select(func.count()).select_from(Order))
        ) or 0
        revenue = await self.db.scalar(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.status.in_(REVENUE_STATUSES)
            )
        )
        return AdminStatsOut(
            total_users=total_users,
            total_products=total_products,
            total_orders=total_orders,
            total_revenue=Decimal(revenue or 0).quantize(Decimal("0.01")),
        )

    async def list_users(self, *, page: int, size: int) -> tuple[list[User], int]:
        total = (await self.db.scalar(select(func.count()).select_from(User))) or 0
        stmt = (
            select(User)
            .order_by(User.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        users = list((await self.db.scalars(stmt)).all())
        return users, total

    async def get_user(self, user_id: uuid.UUID) -> User:
        user = await self.db.get(User, user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    async def update_user(
        self, acting_admin: User, user_id: uuid.UUID, payload: AdminUserUpdate
    ) -> User:
        user = await self.get_user(user_id)

        # Guardrails: an admin must not lock themselves out or demote themselves.
        if user.id == acting_admin.id:
            if payload.is_active is False:
                raise ConflictError("You cannot deactivate your own account")
            if payload.role is not None and payload.role != UserRole.ADMIN:
                raise ConflictError("You cannot change your own admin role")

        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(user, field, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user
