import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.address import Address
from app.models.user import User
from app.schemas.address import AddressCreate, AddressUpdate


class AddressService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(self, user: User) -> list[Address]:
        stmt = (
            select(Address)
            .where(Address.user_id == user.id)
            .order_by(Address.is_default.desc(), Address.created_at.desc())
        )
        return list((await self.db.scalars(stmt)).all())

    async def create(self, user: User, payload: AddressCreate) -> Address:
        first_address = not await self._user_has_any(user.id)
        address = Address(user_id=user.id, **payload.model_dump())
        # First address is always default; explicit default clears siblings.
        if first_address:
            address.is_default = True
        elif payload.is_default:
            await self._clear_default(user.id)
        self.db.add(address)
        await self.db.commit()
        await self.db.refresh(address)
        return address

    async def update(
        self, user: User, address_id: uuid.UUID, payload: AddressUpdate
    ) -> Address:
        address = await self._get_owned(user, address_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("is_default") is True:
            await self._clear_default(user.id, exclude_id=address.id)
        for field, value in data.items():
            setattr(address, field, value)
        await self.db.commit()
        await self.db.refresh(address)
        return address

    async def delete(self, user: User, address_id: uuid.UUID) -> None:
        address = await self._get_owned(user, address_id)
        was_default = address.is_default
        await self.db.delete(address)
        await self.db.commit()
        if was_default:
            # Promote the newest remaining address to default so the user
            # always has one pre-selected at checkout.
            stmt = (
                select(Address)
                .where(Address.user_id == user.id)
                .order_by(Address.created_at.desc())
                .limit(1)
            )
            next_default = await self.db.scalar(stmt)
            if next_default is not None:
                next_default.is_default = True
                await self.db.commit()

    async def get_for_user(self, user: User, address_id: uuid.UUID) -> Address:
        return await self._get_owned(user, address_id)

    async def _get_owned(self, user: User, address_id: uuid.UUID) -> Address:
        address = await self.db.get(Address, address_id)
        if address is None:
            raise NotFoundError("Address not found")
        if address.user_id != user.id:
            raise PermissionDeniedError("Not allowed to access this address")
        return address

    async def _clear_default(
        self, user_id: uuid.UUID, exclude_id: uuid.UUID | None = None
    ) -> None:
        stmt = (
            update(Address)
            .where(Address.user_id == user_id, Address.is_default.is_(True))
            .values(is_default=False)
        )
        if exclude_id is not None:
            stmt = stmt.where(Address.id != exclude_id)
        await self.db.execute(stmt)

    async def _user_has_any(self, user_id: uuid.UUID) -> bool:
        stmt = select(Address.id).where(Address.user_id == user_id).limit(1)
        return (await self.db.scalar(stmt)) is not None
