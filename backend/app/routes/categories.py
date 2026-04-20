from fastapi import APIRouter
from sqlalchemy import select

from app.models.product import Category
from app.routes.deps import DbSession
from app.schemas.product import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(db: DbSession) -> list[CategoryOut]:
    result = await db.execute(select(Category).order_by(Category.name))
    return [CategoryOut.model_validate(c) for c in result.scalars().all()]
