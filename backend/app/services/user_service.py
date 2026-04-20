from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    InvalidCredentialsError,
    ValidationFailedError,
)
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, UserProfileUpdate


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_profile(self, user: User, payload: UserProfileUpdate) -> User:
        changing_email = (
            payload.email is not None and payload.email.lower() != user.email
        )
        changing_password = payload.password is not None

        if (changing_email or changing_password) and not payload.current_password:
            raise ValidationFailedError(
                "current_password is required to change email or password"
            )

        if payload.current_password is not None:
            if not verify_password(payload.current_password, user.password_hash):
                raise InvalidCredentialsError("Current password is incorrect")

        if changing_email:
            assert payload.email is not None
            new_email = payload.email.lower()
            existing = await self.db.scalar(
                select(User).where(User.email == new_email, User.id != user.id)
            )
            if existing is not None:
                raise ConflictError("A user with this email already exists")
            user.email = new_email

        if payload.full_name is not None:
            user.full_name = payload.full_name or None

        if changing_password:
            assert payload.password is not None
            user.password_hash = hash_password(payload.password)

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def change_password(
        self, user: User, payload: ChangePasswordRequest
    ) -> None:
        if payload.new_password != payload.confirm_password:
            raise ValidationFailedError(
                "New password and confirmation do not match"
            )
        if payload.new_password == payload.current_password:
            raise ValidationFailedError(
                "New password must differ from the current password"
            )
        if not verify_password(payload.current_password, user.password_hash):
            raise InvalidCredentialsError("Current password is incorrect")
        user.password_hash = hash_password(payload.new_password)
        await self.db.commit()

    async def set_avatar_url(self, user: User, url: str) -> User:
        user.avatar_url = url
        await self.db.commit()
        await self.db.refresh(user)
        return user
