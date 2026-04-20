import asyncio

import stripe
from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.logging import get_logger
from app.routes.deps import CurrentUser, DbSession
from app.schemas.order import OrderOut, PaymentIntentCreate, PaymentIntentResponse
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payment", tags=["payment"])
logger = get_logger(__name__)


@router.post("/create-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    payload: PaymentIntentCreate,
    user: CurrentUser,
    db: DbSession,
) -> PaymentIntentResponse:
    result = await PaymentService(db).create_payment_intent(user, payload.address_id)
    return PaymentIntentResponse(**result)


@router.get("/order/{pi_id}", response_model=OrderOut)
async def get_order_by_payment_intent(
    pi_id: str,
    user: CurrentUser,
    db: DbSession,
) -> OrderOut:
    """Polls (or idempotently creates) the order for a succeeded PaymentIntent."""
    order = await PaymentService(db).get_or_create_order_by_pi(pi_id, user)
    return OrderOut.model_validate(order)


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def stripe_webhook(request: Request, db: DbSession) -> dict:
    """
    Receives Stripe webhook events. Must use raw body for signature verification.
    No JWT auth — authenticated by Stripe-Signature header instead.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.stripe_webhook_secret:
        # Dev shortcut: skip verification when secret is not configured.
        # NEVER leave this in production.
        logger.warning("stripe_webhook_secret_not_set_skipping_verification")
        try:
            import json
            event = json.loads(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        try:
            event = await asyncio.to_thread(
                stripe.Webhook.construct_event,
                payload,
                sig_header,
                settings.stripe_webhook_secret,
            )
        except stripe.error.SignatureVerificationError:
            logger.warning("stripe_webhook_invalid_signature")
            raise HTTPException(status_code=400, detail="Invalid Stripe signature")
        except Exception as exc:
            logger.exception("stripe_webhook_parse_error")
            raise HTTPException(status_code=400, detail=str(exc))

    event_type: str = event.get("type", "")
    pi_data = event.get("data", {}).get("object", {})

    if event_type == "payment_intent.succeeded":
        logger.info("stripe_event_pi_succeeded", pi_id=pi_data.get("id"))
        await PaymentService(db).handle_payment_intent_succeeded(pi_data)

    elif event_type == "payment_intent.payment_failed":
        logger.warning(
            "stripe_event_pi_failed",
            pi_id=pi_data.get("id"),
            reason=pi_data.get("last_payment_error", {}).get("message"),
        )

    else:
        logger.info("stripe_event_unhandled", event_type=event_type)

    return {"received": True}
