"""add stripe payment fields to orders

Revision ID: 0003_stripe_payment
Revises: 0002_profile_addresses
Create Date: 2026-04-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_stripe_payment"
down_revision: Union[str, None] = "0002_profile_addresses"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "stripe_payment_intent_id",
            sa.String(255),
            nullable=True,
            unique=True,
        ),
    )
    op.create_index(
        "ix_orders_stripe_pi_id",
        "orders",
        ["stripe_payment_intent_id"],
        unique=True,
    )
    op.add_column(
        "orders",
        sa.Column(
            "payment_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
    )


def downgrade() -> None:
    op.drop_column("orders", "payment_status")
    op.drop_index("ix_orders_stripe_pi_id", table_name="orders")
    op.drop_column("orders", "stripe_payment_intent_id")
