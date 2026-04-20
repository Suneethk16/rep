import uuid
from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile

from app.routes.deps import AdminUser, DbSession
from app.schemas.admin import (
    AdminStatsOut,
    AdminUserOut,
    AdminUserUpdate,
    UploadOut,
)
from app.services.admin_service import AdminService
from app.services.upload_service import save_product_image

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsOut)
async def stats(db: DbSession, _admin: AdminUser) -> AdminStatsOut:
    return await AdminService(db).stats()


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    db: DbSession,
    _admin: AdminUser,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[AdminUserOut]:
    users, _total = await AdminService(db).list_users(page=page, size=size)
    return [AdminUserOut.model_validate(u) for u in users]


@router.get("/users/{user_id}", response_model=AdminUserOut)
async def get_user(
    user_id: uuid.UUID, db: DbSession, _admin: AdminUser
) -> AdminUserOut:
    user = await AdminService(db).get_user(user_id)
    return AdminUserOut.model_validate(user)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    db: DbSession,
    admin: AdminUser,
) -> AdminUserOut:
    user = await AdminService(db).update_user(admin, user_id, payload)
    return AdminUserOut.model_validate(user)


@router.post("/uploads/product-image", response_model=UploadOut)
async def upload_product_image(
    file: Annotated[UploadFile, File()],
    _admin: AdminUser,
) -> UploadOut:
    url = await save_product_image(file)
    return UploadOut(url=url)
