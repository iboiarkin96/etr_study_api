"""add_user_reminder

Adds the daily-reminder preference to ``users``:

* ``reminder_enabled`` — 0/1 toggle, default on (the new-user state on the
  Profile screen shows the nudge armed at 09:00 local).
* ``reminder_at`` — wall-clock 'HH:MM' in the user's own ``timezone``; the
  bot resolves it to an absolute instant at send time so a timezone move
  never shifts the chosen local hour.

Backing T-23 (Profile screen) of the Telegram Mini App epic.

Revision ID: 20260721_0004
Revises: 20260719_0003
Create Date: 2026-07-21
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260721_0004"
down_revision: Union[str, None] = "20260719_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "reminder_enabled",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "reminder_at",
            sa.String(length=5),
            nullable=False,
            server_default=sa.text("'09:00'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "reminder_at")
    op.drop_column("users", "reminder_enabled")
