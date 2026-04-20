import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.models.product import Category
from app.routes.deps import AdminUser, DbSession
from app.schemas.product import CategoryIn, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(db: DbSession) -> list[CategoryOut]:
    result = await db.execute(select(Category).order_by(Category.name))
    return [CategoryOut.model_validate(c) for c in result.scalars().all()]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryIn, db: DbSession, _admin: AdminUser
) -> CategoryOut:
    existing = await db.scalar(select(Category).where(Category.slug == payload.slug))
    if existing:
        raise HTTPException(status_code=409, detail="Slug already exists")
    category = Category(name=payload.name, slug=payload.slug)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID, db: DbSession, _admin: AdminUser
) -> None:
    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)
    await db.commit()
