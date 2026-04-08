"""add_timezones_table_and_user_fk

Revision ID: aa545c2b21b9
Revises: 92dfa8a6f233
Create Date: 2026-04-08 10:57:32.175688
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
from zoneinfo import available_timezones
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa545c2b21b9'
down_revision: Union[str, None] = '92dfa8a6f233'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    timezones_table = op.create_table(
        'timezones',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('timezone_uuid', sa.String(length=36), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_timezones_code'), 'timezones', ['code'], unique=True)
    op.create_index(op.f('ix_timezones_timezone_uuid'), 'timezones', ['timezone_uuid'], unique=True)

    rows = [
        {"timezone_uuid": str(uuid4()), "code": tz, "name": tz}
        for tz in sorted(available_timezones())
    ]
    op.bulk_insert(timezones_table, rows)

    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('timezone_uuid', sa.String(length=36), nullable=True))
        batch_op.create_index('ix_users_timezone_uuid', ['timezone_uuid'], unique=False)
        batch_op.create_foreign_key('fk_users_timezone_uuid', 'timezones', ['timezone_uuid'], ['timezone_uuid'])


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('fk_users_timezone_uuid', type_='foreignkey')
        batch_op.drop_index('ix_users_timezone_uuid')
        batch_op.drop_column('timezone_uuid')
    op.drop_index(op.f('ix_timezones_timezone_uuid'), table_name='timezones')
    op.drop_index(op.f('ix_timezones_code'), table_name='timezones')
    op.drop_table('timezones')
