"""timezone_natural_key

Drop surrogate timezone_uuid columns from both tables.
Make users.timezone a FK referencing timezones.code (natural key).

Revision ID: 7e2fd5360fa5
Revises: aa545c2b21b9
Create Date: 2026-04-08 11:06:41.138944
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7e2fd5360fa5'
down_revision: Union[str, None] = 'aa545c2b21b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- timezones: drop surrogate uuid column ---
    with op.batch_alter_table('timezones') as batch_op:
        batch_op.drop_index('ix_timezones_timezone_uuid')
        batch_op.drop_column('timezone_uuid')

    # --- users: drop timezone_uuid FK, add natural FK timezone -> timezones.code ---
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('fk_users_timezone_uuid', type_='foreignkey')
        batch_op.drop_index('ix_users_timezone_uuid')
        batch_op.drop_column('timezone_uuid')
        batch_op.create_foreign_key(
            'fk_users_timezone_code', 'timezones', ['timezone'], ['code'],
        )


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('fk_users_timezone_code', type_='foreignkey')
        batch_op.add_column(sa.Column('timezone_uuid', sa.VARCHAR(length=36), nullable=True))
        batch_op.create_index('ix_users_timezone_uuid', ['timezone_uuid'], unique=False)
        batch_op.create_foreign_key(
            'fk_users_timezone_uuid', 'timezones', ['timezone_uuid'], ['timezone_uuid'],
        )

    with op.batch_alter_table('timezones') as batch_op:
        batch_op.add_column(sa.Column('timezone_uuid', sa.VARCHAR(length=36), nullable=False))
        batch_op.create_index('ix_timezones_timezone_uuid', ['timezone_uuid'], unique=True)
