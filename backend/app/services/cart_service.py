import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.cart import Cart, CartItem
from app.models.product import Product
from app.models.user import User
from app.schemas.cart import CartItemIn, CartItemOut, CartOut
from app.services.product_service import calculate_line_total


class CartService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_or_create_cart(self, user: User) -> Cart:
        cart = await self.db.scalar(select(Cart).where(Cart.user_id == user.id))
        if cart is None:
            cart = Cart(user_id=user.id)
            self.db.add(cart)
            await self.db.commit()
            await self.db.refresh(cart)
        return cart

    async def view(self, user: User) -> CartOut:
        cart = await self._get_or_create_cart(user)
        return self._render(cart)

    async def add_item(self, user: User, payload: CartItemIn) -> CartOut:
        cart = await self._get_or_create_cart(user)
        product = await self.db.get(Product, payload.product_id)
        if product is None:
            raise NotFoundError("Product not found")
        if product.stock < payload.quantity:
            raise ConflictError(f"Only {product.stock} in stock for {product.name}")

        existing = await self.db.scalar(
            select(CartItem).where(
                CartItem.cart_id == cart.id, CartItem.product_id == product.id
            )
        )
        if existing is None:
            self.db.add(
                CartItem(cart_id=cart.id, product_id=product.id, quantity=payload.quantity)
            )
        else:
            new_qty = existing.quantity + payload.quantity
            if product.stock < new_qty:
                raise ConflictError(f"Only {product.stock} in stock for {product.name}")
            existing.quantity = new_qty

        await self.db.commit()
        await self.db.refresh(cart)
        return self._render(cart)

    async def update_item(
        self, user: User, item_id: uuid.UUID, quantity: int
    ) -> CartOut:
        cart = await self._get_or_create_cart(user)
        item = await self.db.scalar(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        )
        if item is None:
            raise NotFoundError("Cart item not found")
        if item.product.stock < quantity:
            raise ConflictError(f"Only {item.product.stock} in stock")
        item.quantity = quantity
        await self.db.commit()
        await self.db.refresh(cart)
        return self._render(cart)

    async def remove_item(self, user: User, item_id: uuid.UUID) -> CartOut:
        cart = await self._get_or_create_cart(user)
        item = await self.db.scalar(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        )
        if item is None:
            raise NotFoundError("Cart item not found")
        await self.db.delete(item)
        await self.db.commit()
        await self.db.refresh(cart)
        return self._render(cart)

    async def clear(self, user: User) -> CartOut:
        cart = await self._get_or_create_cart(user)
        for item in list(cart.items):
            await self.db.delete(item)
        await self.db.commit()
        await self.db.refresh(cart)
        return self._render(cart)

    @staticmethod
    def _render(cart: Cart) -> CartOut:
        items_out: list[CartItemOut] = []
        total = Decimal("0.00")
        for item in cart.items:
            line = calculate_line_total(item.product.price, item.quantity)
            total += line
            items_out.append(
                CartItemOut(
                    id=item.id,
                    product_id=item.product_id,
                    product_name=item.product.name,
                    product_image_url=item.product.image_url,
                    product_stock=item.product.stock,
                    unit_price=item.product.price,
                    quantity=item.quantity,
                    line_total=line,
                )
            )
        return CartOut(id=cart.id, items=items_out, total=total.quantize(Decimal("0.01")))
