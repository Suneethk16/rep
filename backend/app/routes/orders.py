import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.routes.deps import AdminUser, CurrentUser, DbSession
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate
from app.services.order_service import OrderService
from app.workers.tasks import send_order_confirmation

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate, user: CurrentUser, db: DbSession
) -> OrderOut:
    order = await OrderService(db).checkout(user, payload)
    send_order_confirmation.delay(str(order.id), user.email)
    return OrderOut.model_validate(order)


@router.get("", response_model=list[OrderOut])
async def list_my_orders(user: CurrentUser, db: DbSession) -> list[OrderOut]:
    orders = await OrderService(db).list_for_user(user)
    return [OrderOut.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> OrderOut:
    order = await OrderService(db).get(user, order_id)
    return OrderOut.model_validate(order)


# ─── Admin ───────────────────────────────────────────────────────────


@router.get("/admin/all", response_model=list[OrderOut])
async def admin_list_orders(
    db: DbSession,
    _admin: AdminUser,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[OrderOut]:
    orders = await OrderService(db).list_all(page=page, size=size)
    return [OrderOut.model_validate(o) for o in orders]


@router.patch("/admin/{order_id}/status", response_model=OrderOut)
async def admin_update_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    db: DbSession,
    _admin: AdminUser,
) -> OrderOut:
    order = await OrderService(db).update_status(order_id, payload.status)
    return OrderOut.model_validate(order)
