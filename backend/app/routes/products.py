import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.routes.deps import AdminUser, DbSession, RedisClient
from app.schemas.product import ProductIn, ProductListOut, ProductOut, ProductUpdate
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductListOut)
async def list_products(
    db: DbSession,
    redis: RedisClient,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: str | None = None,
    category_id: uuid.UUID | None = None,
) -> ProductListOut:
    products, total = await ProductService(db, redis).list(
        page=page, size=size, q=q, category_id=category_id
    )
    return ProductListOut(
        items=[ProductOut.model_validate(p) for p in products],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: uuid.UUID, db: DbSession, redis: RedisClient
) -> ProductOut:
    product = await ProductService(db, redis).get(product_id)
    return ProductOut.model_validate(product)


@router.post(
    "",
    response_model=ProductOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[],
)
async def create_product(
    payload: ProductIn,
    db: DbSession,
    redis: RedisClient,
    _admin: AdminUser,
) -> ProductOut:
    product = await ProductService(db, redis).create(payload)
    return ProductOut.model_validate(product)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: DbSession,
    redis: RedisClient,
    _admin: AdminUser,
) -> ProductOut:
    product = await ProductService(db, redis).update(product_id, payload)
    return ProductOut.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    db: DbSession,
    redis: RedisClient,
    _admin: AdminUser,
) -> None:
    await ProductService(db, redis).delete(product_id)
