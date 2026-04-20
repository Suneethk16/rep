from fastapi import APIRouter, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated

from fastapi import Depends

from app.routes.deps import CurrentUser, DbSession
from app.schemas.token import RefreshRequest, TokenPair
from app.schemas.user import UserLogin, UserPublic, UserRegister
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: DbSession) -> UserPublic:
    user = await AuthService(db).register(payload)
    return UserPublic.model_validate(user)


@router.post("/login", response_model=TokenPair)
async def login(payload: UserLogin, db: DbSession) -> TokenPair:
    service = AuthService(db)
    user = await service.authenticate(payload)
    return service.issue_tokens(user)


@router.post("/login/form", response_model=TokenPair, include_in_schema=False)
async def login_form(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> TokenPair:
    """OAuth2 password-flow form endpoint — required for Swagger's Authorize button."""
    service = AuthService(db)
    user = await service.authenticate(UserLogin(email=form.username, password=form.password))
    return service.issue_tokens(user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    return await AuthService(db).refresh(payload.refresh_token)


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)
