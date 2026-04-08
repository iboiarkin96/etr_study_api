"""drop_telegram_user_id

Revision ID: 07954728796c
Revises: 7e2fd5360fa5
Create Date: 2026-04-08 11:11:22.639213
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '07954728796c'
down_revision: Union[str, None] = '7e2fd5360fa5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_telegram_user_id')
        batch_op.drop_column('telegram_user_id')


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('telegram_user_id', sa.INTEGER(), nullable=False))
        batch_op.create_index('ix_users_telegram_user_id', ['telegram_user_id'], unique=True)
