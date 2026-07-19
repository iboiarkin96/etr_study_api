"""add_telegram_users

Introduces ``telegram_users`` — a per-provider identity table that binds a
Telegram account to a row in ``users``. Keeps ``users`` free of provider-specific
columns so future auth methods (Google, Apple, etc.) get their own sibling
tables instead of ballooning the core table.

Backing T-01 of the Telegram Mini App epic W1.

Revision ID: 20260719_0003
Revises: 20260712_0002
Create Date: 2026-07-19
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260719_0003"
down_revision: Union[str, None] = "20260712_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Runtime code imports the same constants from app.core.telegram_identity;
# duplicated here so the migration stays self-contained (no app imports at
# alembic time).
TELEGRAM_SYSTEM_UUID = "00000000-0000-4000-8000-000000000001"
TELEGRAM_SYSTEM_CODE = "telegram"
TELEGRAM_SYSTEM_NAME = "Telegram Mini App"


def upgrade() -> None:
    # Idempotent seed: if the telegram system row already exists (partial-run
    # recovery, hand-inserted during dev, etc.), do not fail the migration.
    # TELEGRAM_SYSTEM_UUID / _CODE / _NAME are hard-coded constants — no
    # user input, so an inline SQL literal is safe.
    op.execute(
        f"""
        INSERT INTO systems (system_uuid, code, name)
        VALUES ('{TELEGRAM_SYSTEM_UUID}', '{TELEGRAM_SYSTEM_CODE}', '{TELEGRAM_SYSTEM_NAME}')
        ON CONFLICT (system_uuid) DO NOTHING
        """
    )

    op.create_table(
        "telegram_users",
        sa.Column("telegram_user_uuid", sa.String(length=36), nullable=False),
        sa.Column("client_uuid", sa.String(length=36), nullable=False),
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=False),
        sa.Column("telegram_username", sa.String(length=64), nullable=True),
        sa.Column("telegram_photo_url", sa.String(length=512), nullable=True),
        sa.Column("locale", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("telegram_user_uuid"),
        sa.ForeignKeyConstraint(
            ["client_uuid"],
            ["users.client_uuid"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_telegram_users_client_uuid",
        "telegram_users",
        ["client_uuid"],
        unique=True,
    )
    op.create_index(
        "ix_telegram_users_telegram_user_id",
        "telegram_users",
        ["telegram_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_telegram_users_telegram_user_id", table_name="telegram_users")
    op.drop_index("ix_telegram_users_client_uuid", table_name="telegram_users")
    op.drop_table("telegram_users")
    # TELEGRAM_SYSTEM_UUID is a hard-coded constant (no user input), so an
    # inline value here is safe and side-steps op.execute's inconsistent
    # bindparams handling across Alembic versions.
    op.execute(f"DELETE FROM systems WHERE system_uuid = '{TELEGRAM_SYSTEM_UUID}'")
