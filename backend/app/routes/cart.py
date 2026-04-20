import uuid

from fastapi import APIRouter, status

from app.routes.deps import CurrentUser, DbSession
from app.schemas.cart import CartItemIn, CartItemUpdate, CartOut
from app.services.cart_service import CartService

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("", response_model=CartOut)
async def view_cart(user: CurrentUser, db: DbSession) -> CartOut:
    return await CartService(db).view(user)


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
async def add_item(payload: CartItemIn, user: CurrentUser, db: DbSession) -> CartOut:
    return await CartService(db).add_item(user, payload)


@router.patch("/items/{item_id}", response_model=CartOut)
async def update_item(
    item_id: uuid.UUID,
    payload: CartItemUpdate,
    user: CurrentUser,
    db: DbSession,
) -> CartOut:
    return await CartService(db).update_item(user, item_id, payload.quantity)


@router.delete("/items/{item_id}", response_model=CartOut)
async def remove_item(item_id: uuid.UUID, user: CurrentUser, db: DbSession) -> CartOut:
    return await CartService(db).remove_item(user, item_id)


@router.delete("", response_model=CartOut)
async def clear_cart(user: CurrentUser, db: DbSession) -> CartOut:
    return await CartService(db).clear(user)
