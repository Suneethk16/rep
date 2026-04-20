import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationFailedError,
)
from app.models.address import Address
from app.models.cart import Cart
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.user import User, UserRole
from app.schemas.order import OrderCreate
from app.services.product_service import calculate_line_total


def _format_address_snapshot(address: Address) -> str:
    lines = [
        address.full_name,
        address.phone_number,
        address.street,
        f"{address.city}, {address.state} {address.postal_code}",
        address.country,
    ]
    return "\n".join(line for line in lines if line)


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def checkout(self, user: User, payload: OrderCreate) -> Order:
        cart = await self.db.scalar(select(Cart).where(Cart.user_id == user.id))
        if cart is None or not cart.items:
            raise ConflictError("Cart is empty")

        address_id: uuid.UUID | None = None
        if payload.address_id is not None:
            address = await self.db.get(Address, payload.address_id)
            if address is None:
                raise NotFoundError("Address not found")
            if address.user_id != user.id:
                raise PermissionDeniedError("Not allowed to use this address")
            shipping_address = _format_address_snapshot(address)
            address_id = address.id
        elif payload.shipping_address:
            shipping_address = payload.shipping_address
        else:
            raise ValidationFailedError(
                "Either address_id or shipping_address is required"
            )

        order = Order(
            user_id=user.id,
            status=OrderStatus.PENDING,
            shipping_address=shipping_address,
            address_id=address_id,
            total=Decimal("0.00"),
        )
        total = Decimal("0.00")

        for cart_item in cart.items:
            product = await self.db.get(Product, cart_item.product_id, with_for_update=True)
            if product is None:
                raise NotFoundError(f"Product {cart_item.product_id} no longer exists")
            if product.stock < cart_item.quantity:
                raise ConflictError(
                    f"Insufficient stock for {product.name} "
                    f"(requested {cart_item.quantity}, have {product.stock})"
                )
            product.stock -= cart_item.quantity
            line_total = calculate_line_total(product.price, cart_item.quantity)
            total += line_total
            order.items.append(
                OrderItem(
                    product_id=product.id,
                    product_name=product.name,
                    unit_price=product.price,
                    quantity=cart_item.quantity,
                )
            )

        order.total = total.quantize(Decimal("0.01"))
        self.db.add(order)

        for item in list(cart.items):
            await self.db.delete(item)

        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def get(self, user: User, order_id: uuid.UUID) -> Order:
        order = await self.db.get(Order, order_id)
        if order is None:
            raise NotFoundError("Order not found")
        if order.user_id != user.id and user.role != UserRole.ADMIN:
            raise PermissionDeniedError("Not allowed to view this order")
        return order

    async def list_for_user(self, user: User) -> list[Order]:
        stmt = select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc())
        return list((await self.db.scalars(stmt)).all())

    async def list_all(self, *, page: int, size: int) -> list[Order]:
        stmt = (
            select(Order)
            .order_by(Order.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        return list((await self.db.scalars(stmt)).all())

    async def update_status(self, order_id: uuid.UUID, status: OrderStatus) -> Order:
        order = await self.db.get(Order, order_id)
        if order is None:
            raise NotFoundError("Order not found")
        order.status = status
        await self.db.commit()
        await self.db.refresh(order)
        return order
