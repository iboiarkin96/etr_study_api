"""timezone_add_utc_offset_drop_name

Add utc_offset (integer hours) to timezones, drop name column.
Backfill offsets from zoneinfo using Jan 1 (standard / non-DST).

Revision ID: 3140a9a20545
Revises: 3996b1b4db65
Create Date: 2026-04-08 11:19:43.521285
"""
from datetime import datetime, timezone as tz
from typing import Sequence, Union

from alembic import op
from zoneinfo import ZoneInfo, available_timezones
import sqlalchemy as sa


revision: str = '3140a9a20545'
down_revision: Union[str, None] = '3996b1b4db65'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Use Jan 1 to get standard (non-DST) offset
_REF_DT = datetime(2026, 1, 1, tzinfo=tz.utc)


def _offset_hours(code: str) -> int:
    return int(ZoneInfo(code).utcoffset(_REF_DT).total_seconds() // 3600)


def upgrade() -> None:
    # Add column with a temporary default so existing rows pass NOT NULL
    with op.batch_alter_table('timezones') as batch_op:
        batch_op.add_column(
            sa.Column('utc_offset', sa.Integer(), nullable=False, server_default=sa.text("0")),
        )
        batch_op.drop_column('name')

    # Backfill real offsets
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, code FROM timezones")).fetchall()
    for row_id, code in rows:
        try:
            offset = _offset_hours(code)
        except Exception:
            offset = 0
        conn.execute(
            sa.text("UPDATE timezones SET utc_offset = :offset WHERE id = :id"),
            {"offset": offset, "id": row_id},
        )

    # Remove server default now that all rows are populated
    with op.batch_alter_table('timezones') as batch_op:
        batch_op.alter_column('utc_offset', server_default=None)


def downgrade() -> None:
    with op.batch_alter_table('timezones') as batch_op:
        batch_op.add_column(sa.Column('name', sa.VARCHAR(length=128), nullable=False, server_default=sa.text("''")))
        batch_op.drop_column('utc_offset')

    # Restore name = code
    op.execute("UPDATE timezones SET name = code")

    with op.batch_alter_table('timezones') as batch_op:
        batch_op.alter_column('name', server_default=None)
