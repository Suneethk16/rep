from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import RequestLoggingMiddleware, configure_logging, get_logger
from app.core.security import hash_password
from app.db.redis import close_redis, get_redis
from app.db.session import AsyncSessionLocal
from app.routes import admin as admin_routes
from app.routes import auth as auth_routes
from app.routes import cart as cart_routes
from app.routes import categories as categories_routes
from app.routes import orders as orders_routes
from app.routes import products as products_routes
from app.routes import payment as payment_routes
from app.routes import user as user_routes


async def _seed_admin() -> None:
    from sqlalchemy import select
    from app.models.user import User, UserRole

    if not settings.first_admin_email or not settings.first_admin_password:
        return
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == settings.first_admin_email))
        if existing:
            return
        admin = User(
            email=settings.first_admin_email,
            hashed_password=hash_password(settings.first_admin_password),
            full_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger = get_logger()
    logger.info("app_startup", env=settings.app_env)
    await get_redis()
    await _seed_admin()
    try:
        yield
    finally:
        await close_redis()
        logger.info("app_shutdown")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.add_middleware(RequestLoggingMiddleware)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Serve admin-uploaded product images. Directory is created lazily by the
# upload service; this mount just needs to exist at import time.
_uploads_dir = Path("/app/uploads")
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/health", tags=["health"], include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_routes.router, prefix=settings.api_v1_prefix)
app.include_router(categories_routes.router, prefix=settings.api_v1_prefix)
app.include_router(products_routes.router, prefix=settings.api_v1_prefix)
app.include_router(cart_routes.router, prefix=settings.api_v1_prefix)
app.include_router(orders_routes.router, prefix=settings.api_v1_prefix)
app.include_router(user_routes.router, prefix=settings.api_v1_prefix)
app.include_router(payment_routes.router, prefix=settings.api_v1_prefix)
app.include_router(admin_routes.router, prefix=settings.api_v1_prefix)
