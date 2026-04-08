"""rename_system_user_uuid_drop_sysmem_name

Rename system_user_uuid -> system_user_id, drop sysmem_name_uuid,
drop the old composite unique constraint.

Revision ID: 3996b1b4db65
Revises: 07954728796c
Create Date: 2026-04-08 11:15:13.855724
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3996b1b4db65'
down_revision: Union[str, None] = '07954728796c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Copy system_user_uuid data into new column, then drop old columns
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('system_user_id', sa.String(length=36), nullable=True))

    # Migrate existing data
    op.execute("UPDATE users SET system_user_id = system_user_uuid")

    with op.batch_alter_table('users') as batch_op:
        batch_op.create_index('ix_users_system_user_id', ['system_user_id'], unique=True)
        batch_op.drop_constraint('uq_users_system_user_uuid_sysmem_name_uuid', type_='unique')
        batch_op.drop_column('sysmem_name_uuid')
        batch_op.drop_column('system_user_uuid')


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('system_user_uuid', sa.VARCHAR(length=36), nullable=True))
        batch_op.add_column(sa.Column('sysmem_name_uuid', sa.VARCHAR(length=36), nullable=True))

    op.execute("UPDATE users SET system_user_uuid = system_user_id")

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_system_user_id')
        batch_op.create_unique_constraint(
            'uq_users_system_user_uuid_sysmem_name_uuid',
            ['system_user_uuid', 'sysmem_name_uuid'],
        )
        batch_op.drop_column('system_user_id')
