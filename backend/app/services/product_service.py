import json
import uuid
from decimal import Decimal
from typing import Any

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models.product import Product
from app.schemas.product import ProductIn, ProductUpdate

logger = get_logger(__name__)

_CACHE_NS = "product"


def _product_key(product_id: uuid.UUID) -> str:
    return f"{_CACHE_NS}:id:{product_id}"


def _list_key(page: int, size: int, q: str | None, category_id: uuid.UUID | None) -> str:
    return f"{_CACHE_NS}:list:{page}:{size}:{q or ''}:{category_id or ''}"


def _serialize(product: Product) -> dict[str, Any]:
    return {
        "id": str(product.id),
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "price": str(product.price),
        "stock": product.stock,
        "image_url": product.image_url,
        "category_id": str(product.category_id) if product.category_id else None,
        "created_at": product.created_at.isoformat(),
        "updated_at": product.updated_at.isoformat(),
    }


class ProductService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis
        self.ttl = settings.product_cache_ttl_seconds

    async def list(
        self,
        *,
        page: int,
        size: int,
        q: str | None,
        category_id: uuid.UUID | None,
    ) -> tuple[list[Product], int]:
        key = _list_key(page, size, q, category_id)
        cached = await self._safe_get(key)
        if cached is not None:
            ids = [uuid.UUID(i) for i in cached["ids"]]
            total = cached["total"]
            if ids:
                stmt = select(Product).where(Product.id.in_(ids))
                products = list((await self.db.scalars(stmt)).all())
                products.sort(key=lambda p: ids.index(p.id))
                return products, total
            return [], total

        stmt = select(Product)
        count_stmt = select(func.count()).select_from(Product)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(Product.name.ilike(like))
            count_stmt = count_stmt.where(Product.name.ilike(like))
        if category_id:
            stmt = stmt.where(Product.category_id == category_id)
            count_stmt = count_stmt.where(Product.category_id == category_id)

        total = (await self.db.scalar(count_stmt)) or 0
        stmt = stmt.order_by(Product.created_at.desc()).offset((page - 1) * size).limit(size)
        products = list((await self.db.scalars(stmt)).all())

        await self._safe_set(
            key, {"ids": [str(p.id) for p in products], "total": total}
        )
        return products, total

    async def get(self, product_id: uuid.UUID) -> Product:
        cached = await self._safe_get(_product_key(product_id))
        if cached is not None:
            product = await self.db.get(Product, product_id)
            if product is not None:
                return product

        product = await self.db.get(Product, product_id)
        if product is None:
            raise NotFoundError("Product not found")
        await self._safe_set(_product_key(product_id), _serialize(product))
        return product

    async def create(self, payload: ProductIn) -> Product:
        existing = await self.db.scalar(select(Product).where(Product.sku == payload.sku))
        if existing is not None:
            raise ConflictError("A product with this SKU already exists")

        product = Product(**payload.model_dump())
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        await self._invalidate_lists()
        return product

    async def update(self, product_id: uuid.UUID, payload: ProductUpdate) -> Product:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise NotFoundError("Product not found")

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(product, field, value)
        await self.db.commit()
        await self.db.refresh(product)
        await self._invalidate(product_id)
        return product

    async def delete(self, product_id: uuid.UUID) -> None:
        product = await self.db.get(Product, product_id)
        if product is None:
            raise NotFoundError("Product not found")
        await self.db.delete(product)
        await self.db.commit()
        await self._invalidate(product_id)

    async def adjust_stock(self, product_id: uuid.UUID, delta: int) -> Product:
        product = await self.db.get(Product, product_id, with_for_update=True)
        if product is None:
            raise NotFoundError("Product not found")
        new_stock = product.stock + delta
        if new_stock < 0:
            raise ConflictError(f"Insufficient stock for product {product.sku}")
        product.stock = new_stock
        await self._invalidate(product_id)
        return product

    async def _safe_get(self, key: str) -> Any | None:
        try:
            raw = await self.redis.get(key)
        except Exception:  # noqa: BLE001 — cache must never break the request
            logger.warning("redis_cache_get_failed", key=key)
            return None
        return json.loads(raw) if raw else None

    async def _safe_set(self, key: str, value: Any) -> None:
        try:
            await self.redis.set(key, json.dumps(value, default=str), ex=self.ttl)
        except Exception:  # noqa: BLE001
            logger.warning("redis_cache_set_failed", key=key)

    async def _invalidate(self, product_id: uuid.UUID) -> None:
        try:
            await self.redis.delete(_product_key(product_id))
        except Exception:  # noqa: BLE001
            logger.warning("redis_cache_del_failed", product_id=str(product_id))
        await self._invalidate_lists()

    async def _invalidate_lists(self) -> None:
        try:
            async for key in self.redis.scan_iter(match=f"{_CACHE_NS}:list:*"):
                await self.redis.delete(key)
        except Exception:  # noqa: BLE001
            logger.warning("redis_cache_list_scan_failed")


def calculate_line_total(unit_price: Decimal, quantity: int) -> Decimal:
    return (unit_price * quantity).quantize(Decimal("0.01"))
