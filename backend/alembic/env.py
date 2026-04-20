import socket
from logging.config import fileConfig
from urllib.parse import urlparse

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
from app.models import *  # noqa: F401,F403 — register all models with Base.metadata


def _normalize_sync_url(url: str) -> str:
    """Rewrite plain postgresql:// → postgresql+psycopg:// (psycopg v3 sync dialect).
    SQLAlchemy defaults bare postgresql:// to psycopg2, which is not installed."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def _ipv4_connect_args(url: str) -> dict:
    """Force IPv4 + carry SSL settings — Render free tier has no IPv6 outbound,
    and psycopg ignores URL query params when hostaddr is supplied."""
    try:
        from urllib.parse import parse_qs
        parsed = urlparse(url)
        addrs = socket.getaddrinfo(parsed.hostname, parsed.port or 5432, socket.AF_INET)
        args: dict = {"hostaddr": addrs[0][4][0], "sslmode": "require"}
        qs = parse_qs(parsed.query)
        if "sslmode" in qs:
            args["sslmode"] = qs["sslmode"][0]
        return args
    except Exception:
        return {}

config = context.config
_sync_url = _normalize_sync_url(settings.database_url_sync)
config.set_main_option("sqlalchemy.url", _sync_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=_ipv4_connect_args(_sync_url),
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
