"""profile picture + addresses + order address link

Revision ID: 0002_profile_addresses
Revises: 0001_initial
Create Date: 2026-04-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_profile_addresses"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(1024), nullable=True))

    op.create_table(
        "addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone_number", sa.String(32), nullable=False),
        sa.Column("street", sa.String(255), nullable=False),
        sa.Column("city", sa.String(120), nullable=False),
        sa.Column("state", sa.String(120), nullable=False),
        sa.Column("postal_code", sa.String(32), nullable=False),
        sa.Column("country", sa.String(120), nullable=False),
        sa.Column(
            "is_default",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "address_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("addresses.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_orders_address_id", "orders", ["address_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_address_id", table_name="orders")
    op.drop_column("orders", "address_id")
    op.drop_table("addresses")
    op.drop_column("users", "avatar_url")
