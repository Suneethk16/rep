from celery import shared_task

from app.core.logging import get_logger
from app.workers.celery_app import celery_app  # noqa: F401 — ensures app is imported

logger = get_logger(__name__)


@shared_task(
    name="orders.send_order_confirmation",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def send_order_confirmation(self, order_id: str, email: str) -> dict[str, str]:
    """Send a receipt email. In dev this just logs; wire SMTP/SendGrid in prod."""
    logger.info("send_order_confirmation", order_id=order_id, email=email)
    return {"order_id": order_id, "status": "queued"}


@shared_task(
    name="products.reindex",
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def reindex_product(product_id: str) -> dict[str, str]:
    """Placeholder for Elasticsearch reindex when search is swapped."""
    logger.info("reindex_product", product_id=product_id)
    return {"product_id": product_id, "status": "indexed"}
