import uuid
from typing import Annotated

from fastapi import APIRouter, File, UploadFile, status

from app.routes.deps import CurrentUser, DbSession
from app.schemas.address import AddressCreate, AddressOut, AddressUpdate
from app.schemas.user import (
    AvatarUploadOut,
    ChangePasswordRequest,
    UserProfileUpdate,
    UserPublic,
)
from app.services.address_service import AddressService
from app.services.upload_service import save_avatar_image
from app.services.user_service import UserService

router = APIRouter(prefix="/user", tags=["user"])


# ─── Profile ─────────────────────────────────────────────────────────


@router.get("/profile", response_model=UserPublic)
async def get_profile(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)


@router.put("/profile", response_model=UserPublic)
async def update_profile(
    payload: UserProfileUpdate,
    user: CurrentUser,
    db: DbSession,
) -> UserPublic:
    updated = await UserService(db).update_profile(user, payload)
    return UserPublic.model_validate(updated)


@router.put("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    user: CurrentUser,
    db: DbSession,
) -> None:
    await UserService(db).change_password(user, payload)


@router.post("/upload-profile-picture", response_model=AvatarUploadOut)
async def upload_profile_picture(
    file: Annotated[UploadFile, File()],
    user: CurrentUser,
    db: DbSession,
) -> AvatarUploadOut:
    url = await save_avatar_image(file)
    updated = await UserService(db).set_avatar_url(user, url)
    return AvatarUploadOut(avatar_url=updated.avatar_url or url)


# ─── Addresses ───────────────────────────────────────────────────────


@router.get("/addresses", response_model=list[AddressOut])
async def list_addresses(
    user: CurrentUser, db: DbSession
) -> list[AddressOut]:
    addresses = await AddressService(db).list_for_user(user)
    return [AddressOut.model_validate(a) for a in addresses]


@router.post(
    "/addresses",
    response_model=AddressOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_address(
    payload: AddressCreate, user: CurrentUser, db: DbSession
) -> AddressOut:
    address = await AddressService(db).create(user, payload)
    return AddressOut.model_validate(address)


@router.put("/addresses/{address_id}", response_model=AddressOut)
async def update_address(
    address_id: uuid.UUID,
    payload: AddressUpdate,
    user: CurrentUser,
    db: DbSession,
) -> AddressOut:
    address = await AddressService(db).update(user, address_id, payload)
    return AddressOut.model_validate(address)


@router.delete(
    "/addresses/{address_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_address(
    address_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> None:
    await AddressService(db).delete(user, address_id)
