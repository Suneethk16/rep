import asyncio
import uuid
from decimal import Decimal

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationFailedError,
)
from app.core.logging import get_logger
from app.models.address import Address
from app.models.cart import Cart
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.user import User
from app.services.product_service import calculate_line_total

logger = get_logger(__name__)


def _address_snapshot(address: Address) -> str:
    parts = [
        address.full_name,
        address.phone_number,
        address.street,
        f"{address.city}, {address.state} {address.postal_code}",
        address.country,
    ]
    return "\n".join(p for p in parts if p)


class PaymentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        stripe.api_key = settings.stripe_secret_key

    # ─── Create PaymentIntent ─────────────────────────────────────────

    async def create_payment_intent(
        self, user: User, address_id: uuid.UUID
    ) -> dict:
        """Validate cart server-side, create Stripe PaymentIntent, return client_secret."""
        address = await self.db.get(Address, address_id)
        if address is None:
            raise NotFoundError("Address not found")
        if address.user_id != user.id:
            raise PermissionDeniedError("Not allowed to use this address")

        cart = await self.db.scalar(select(Cart).where(Cart.user_id == user.id))
        if cart is None or not cart.items:
            raise ConflictError("Cart is empty")

        total = Decimal("0")
        for item in cart.items:
            product = item.product  # lazy="joined" pre-loads this
            if product is None:
                raise NotFoundError(f"Product {item.product_id} not found")
            if product.stock < item.quantity:
                raise ConflictError(
                    f"Insufficient stock for {product.name} "
                    f"(requested {item.quantity}, available {product.stock})"
                )
            total += calculate_line_total(product.price, item.quantity)

        # Stripe amounts are in the smallest currency unit (paise for INR).
        amount_subunit = int(total * 100)

        try:
            pi = await asyncio.to_thread(
                stripe.PaymentIntent.create,
                amount=amount_subunit,
                currency=settings.stripe_currency,
                automatic_payment_methods={"enabled": True},
                metadata={
                    "user_id": str(user.id),
                    "address_id": str(address_id),
                },
            )
        except stripe.error.AuthenticationError as exc:
            logger.error("stripe_authentication_error", detail=str(exc))
            raise ValidationFailedError(
                "Payment provider is not configured. Contact support."
            ) from exc
        except stripe.error.StripeError as exc:
            logger.error("stripe_api_error", detail=str(exc))
            raise ValidationFailedError(
                f"Payment service error: {exc.user_message or str(exc)}"
            ) from exc

        logger.info(
            "payment_intent_created",
            pi_id=pi.id,
            user_id=str(user.id),
            amount=amount_subunit,
        )

        return {
            "client_secret": pi.client_secret,
            "payment_intent_id": pi.id,
            "amount": total,
            "currency": settings.stripe_currency,
        }

    # ─── Order from PaymentIntent (polling endpoint) ──────────────────

    async def get_or_create_order_by_pi(
        self, pi_id: str, current_user: User
    ) -> Order:
        """Return an existing order or idempotently create one from a succeeded PI."""
        existing = await self.db.scalar(
            select(Order).where(Order.stripe_payment_intent_id == pi_id)
        )
        if existing is not None:
            if existing.user_id != current_user.id:
                raise PermissionDeniedError("Not allowed to view this order")
            return existing

        try:
            pi = await asyncio.to_thread(stripe.PaymentIntent.retrieve, pi_id)
        except stripe.error.InvalidRequestError:
            raise NotFoundError("Payment intent not found")
        except stripe.error.AuthenticationError as exc:
            raise ValidationFailedError(
                "Payment provider is not configured. Contact support."
            ) from exc
        except stripe.error.StripeError as exc:
            raise ValidationFailedError(
                f"Payment service error: {exc.user_message or str(exc)}"
            ) from exc

        # Ownership check via metadata.
        if pi.metadata.get("user_id") != str(current_user.id):
            raise PermissionDeniedError("Not allowed to view this order")

        if pi.status != "succeeded":
            raise ValidationFailedError(
                f"Payment not yet completed (status: {pi.status})"
            )

        return await self._create_order_from_pi(
            user=current_user,
            address_id=uuid.UUID(pi.metadata["address_id"]),
            payment_intent_id=pi_id,
        )

    # ─── Webhook: idempotent order creation ───────────────────────────

    async def handle_payment_intent_succeeded(self, pi: dict) -> None:
        pi_id: str = pi["id"]
        metadata = pi.get("metadata", {})
        user_id_str = metadata.get("user_id")
        address_id_str = metadata.get("address_id")

        if not user_id_str or not address_id_str:
            logger.warning("payment_intent_missing_metadata", pi_id=pi_id)
            return

        # Idempotency: skip if order already exists.
        existing = await self.db.scalar(
            select(Order.id).where(Order.stripe_payment_intent_id == pi_id)
        )
        if existing is not None:
            logger.info("payment_intent_order_already_exists", pi_id=pi_id)
            return

        user = await self.db.get(User, uuid.UUID(user_id_str))
        if user is None:
            logger.warning("payment_intent_user_not_found", pi_id=pi_id)
            return

        try:
            await self._create_order_from_pi(
                user=user,
                address_id=uuid.UUID(address_id_str),
                payment_intent_id=pi_id,
            )
        except Exception:
            logger.exception("payment_intent_order_creation_failed", pi_id=pi_id)
            raise

    # ─── Internal: create order ───────────────────────────────────────

    async def _create_order_from_pi(
        self,
        user: User,
        address_id: uuid.UUID,
        payment_intent_id: str,
    ) -> Order:
        # Double-check idempotency under possible concurrent requests.
        existing = await self.db.scalar(
            select(Order).where(Order.stripe_payment_intent_id == payment_intent_id)
        )
        if existing is not None:
            return existing

        cart = await self.db.scalar(select(Cart).where(Cart.user_id == user.id))
        if cart is None or not cart.items:
            raise ConflictError("Cart is empty — order may have already been placed")

        address = await self.db.get(Address, address_id)
        if address is None:
            raise NotFoundError("Address not found")

        total = Decimal("0")
        order_items: list[OrderItem] = []

        for cart_item in cart.items:
            product = await self.db.get(
                Product, cart_item.product_id, with_for_update=True
            )
            if product is None:
                raise NotFoundError(f"Product {cart_item.product_id} no longer exists")
            if product.stock < cart_item.quantity:
                raise ConflictError(
                    f"Insufficient stock for {product.name} "
                    f"(requested {cart_item.quantity}, have {product.stock})"
                )
            product.stock -= cart_item.quantity
            line = calculate_line_total(product.price, cart_item.quantity)
            total += line
            order_items.append(
                OrderItem(
                    product_id=product.id,
                    product_name=product.name,
                    unit_price=product.price,
                    quantity=cart_item.quantity,
                )
            )

        order = Order(
            user_id=user.id,
            status=OrderStatus.PAID,
            payment_status="succeeded",
            shipping_address=_address_snapshot(address),
            address_id=address_id,
            stripe_payment_intent_id=payment_intent_id,
            total=total.quantize(Decimal("0.01")),
            items=order_items,
        )
        self.db.add(order)

        for item in list(cart.items):
            await self.db.delete(item)

        await self.db.commit()
        await self.db.refresh(order)

        logger.info(
            "order_created_from_payment",
            order_id=str(order.id),
            pi_id=payment_intent_id,
            user_id=str(user.id),
        )
        return order
