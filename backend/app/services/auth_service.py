from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, InvalidCredentialsError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.cart import Cart
from app.models.user import User, UserRole
from app.schemas.token import TokenPair
from app.schemas.user import UserLogin, UserRegister


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, payload: UserRegister) -> User:
        existing = await self.db.scalar(
            select(User).where(User.email == payload.email.lower())
        )
        if existing is not None:
            raise ConflictError("A user with this email already exists")

        user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            password_hash=hash_password(payload.password),
            role=UserRole.USER,
        )
        user.cart = Cart()
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate(self, payload: UserLogin) -> User:
        user = await self.db.scalar(
            select(User).where(User.email == payload.email.lower())
        )
        if user is None or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError("Incorrect email or password")
        if not user.is_active:
            raise InvalidCredentialsError("Account is disabled")
        return user

    def issue_tokens(self, user: User) -> TokenPair:
        return TokenPair(
            access_token=create_access_token(str(user.id), user.role.value),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def refresh(self, refresh_token: str) -> TokenPair:
        payload = decode_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")
        if not user_id:
            raise InvalidCredentialsError("Invalid refresh token")

        user = await self.db.get(User, user_id)
        if user is None or not user.is_active:
            raise InvalidCredentialsError("User not found or inactive")
        return self.issue_tokens(user)
