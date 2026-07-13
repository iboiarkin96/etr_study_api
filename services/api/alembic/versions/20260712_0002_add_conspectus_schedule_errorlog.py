"""add_conspectus_schedule_errorlog

Adds the Conspectus / Schedule / Error-log tables backing the internal spec:
schedule_policies (with reference seed), conspectuses, conspectus_schedules,
conspectus_events, conspectus_review_logs, learning_errors.

Revision ID: 20260712_0002
Revises: 20260411_0001
Create Date: 2026-07-12
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260712_0002"
down_revision: Union[str, None] = "20260411_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_policies",
        sa.Column("schedule_policy_id", sa.String(length=64), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("algorithm_version", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("schedule_policy_id"),
    )
    policy_table = sa.table(
        "schedule_policies",
        sa.column("schedule_policy_id", sa.String(length=64)),
        sa.column("version", sa.String(length=32)),
        sa.column("algorithm_version", sa.String(length=32)),
        sa.column("description", sa.String(length=255)),
    )
    op.bulk_insert(
        policy_table,
        [
            {
                "schedule_policy_id": "etr_methodology_four_slot",
                "version": "1.0.0",
                "algorithm_version": "v1",
                "description": "Reference ETR four-slot review policy (A/B/C/D + D-ladder).",
            }
        ],
    )

    op.create_table(
        "conspectuses",
        sa.Column("conspectus_uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "owner_client_uuid",
            sa.String(length=36),
            sa.ForeignKey("users.client_uuid"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=256), nullable=True),
        sa.Column("cue_sheet", postgresql.JSONB(), nullable=False),
        sa.Column("cue_sheet_schema_version", sa.Integer(), nullable=False),
        sa.Column("dense_paragraph", sa.Text(), nullable=False),
        sa.Column("bullets", postgresql.JSONB(), nullable=False),
        sa.Column("content_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_row_invalid", sa.Integer(), nullable=False),
        sa.Column(
            "invalidation_reason_uuid",
            sa.String(length=36),
            sa.ForeignKey("invalidation_reasons.invalidation_reason_uuid"),
            nullable=True,
        ),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("conspectus_uuid"),
    )
    op.create_index(
        "ix_conspectuses_owner_client_uuid",
        "conspectuses",
        ["owner_client_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_conspectuses_owner_created_desc",
        "conspectuses",
        ["owner_client_uuid", sa.text("created_at DESC"), sa.text("conspectus_uuid DESC")],
        unique=False,
    )

    op.create_table(
        "conspectus_schedules",
        sa.Column(
            "conspectus_uuid",
            sa.String(length=36),
            sa.ForeignKey("conspectuses.conspectus_uuid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "owner_client_uuid",
            sa.String(length=36),
            sa.ForeignKey("users.client_uuid"),
            nullable=False,
        ),
        sa.Column("slot", sa.String(length=1), nullable=False),
        sa.Column("slot_d_ladder_index", sa.Integer(), nullable=False),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("schedule_revision", sa.Integer(), nullable=False),
        sa.Column(
            "schedule_policy_id",
            sa.String(length=64),
            sa.ForeignKey("schedule_policies.schedule_policy_id"),
            nullable=False,
        ),
        sa.Column("schedule_policy_version", sa.String(length=32), nullable=False),
        sa.Column("algorithm_version", sa.String(length=32), nullable=False),
        sa.Column("schedule_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_row_invalid", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("conspectus_uuid"),
    )
    op.create_index(
        "ix_conspectus_schedules_owner_client_uuid",
        "conspectus_schedules",
        ["owner_client_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_conspectus_schedules_next_review_at",
        "conspectus_schedules",
        ["next_review_at"],
        unique=False,
    )
    op.create_index(
        "ix_conspectus_schedules_owner_next_review",
        "conspectus_schedules",
        ["owner_client_uuid", "next_review_at"],
        unique=False,
    )
    op.create_index(
        "ix_conspectus_schedules_owner_slot",
        "conspectus_schedules",
        ["owner_client_uuid", "slot"],
        unique=False,
    )

    op.create_table(
        "conspectus_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "conspectus_uuid",
            sa.String(length=36),
            sa.ForeignKey("conspectuses.conspectus_uuid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "owner_client_uuid",
            sa.String(length=36),
            sa.ForeignKey("users.client_uuid"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("content_version_after", sa.Integer(), nullable=True),
        sa.Column("actor_system_user_id", sa.String(length=36), nullable=False),
        sa.Column("actor_system_uuid", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_conspectus_events_conspectus_uuid",
        "conspectus_events",
        ["conspectus_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_conspectus_events_conspectus_created",
        "conspectus_events",
        ["conspectus_uuid", "created_at", "id"],
        unique=False,
    )

    op.create_table(
        "conspectus_review_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "conspectus_uuid",
            sa.String(length=36),
            sa.ForeignKey("conspectuses.conspectus_uuid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "owner_client_uuid",
            sa.String(length=36),
            sa.ForeignKey("users.client_uuid"),
            nullable=False,
        ),
        sa.Column("tag", sa.String(length=16), nullable=False),
        sa.Column("slot_before", sa.String(length=1), nullable=False),
        sa.Column("slot_after", sa.String(length=1), nullable=False),
        sa.Column("slot_d_ladder_index_before", sa.Integer(), nullable=False),
        sa.Column("slot_d_ladder_index_after", sa.Integer(), nullable=False),
        sa.Column("schedule_revision_before", sa.Integer(), nullable=False),
        sa.Column("schedule_revision_after", sa.Integer(), nullable=False),
        sa.Column("next_review_at_before", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_review_at_after", sa.DateTime(timezone=True), nullable=False),
        sa.Column("algorithm_version", sa.String(length=32), nullable=False),
        sa.Column("schedule_policy_id", sa.String(length=64), nullable=False),
        sa.Column("schedule_policy_version", sa.String(length=32), nullable=False),
        sa.Column("actor_system_user_id", sa.String(length=36), nullable=False),
        sa.Column("actor_system_uuid", sa.String(length=36), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_conspectus_review_logs_conspectus_uuid",
        "conspectus_review_logs",
        ["conspectus_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_conspectus_review_logs_conspectus_created",
        "conspectus_review_logs",
        ["conspectus_uuid", "created_at", "id"],
        unique=False,
    )

    op.create_table(
        "learning_errors",
        sa.Column("error_uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "owner_client_uuid",
            sa.String(length=36),
            sa.ForeignKey("users.client_uuid"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "conspectus_uuid",
            sa.String(length=36),
            sa.ForeignKey("conspectuses.conspectus_uuid", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "review_log_id",
            sa.Integer(),
            sa.ForeignKey("conspectus_review_logs.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("error_uuid"),
    )
    op.create_index(
        "ix_learning_errors_owner_client_uuid",
        "learning_errors",
        ["owner_client_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_learning_errors_conspectus_uuid",
        "learning_errors",
        ["conspectus_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_learning_errors_owner_created_desc",
        "learning_errors",
        ["owner_client_uuid", sa.text("created_at DESC"), sa.text("error_uuid DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_learning_errors_owner_created_desc", table_name="learning_errors")
    op.drop_index("ix_learning_errors_conspectus_uuid", table_name="learning_errors")
    op.drop_index("ix_learning_errors_owner_client_uuid", table_name="learning_errors")
    op.drop_table("learning_errors")

    op.drop_index("ix_conspectus_review_logs_conspectus_created", table_name="conspectus_review_logs")
    op.drop_index("ix_conspectus_review_logs_conspectus_uuid", table_name="conspectus_review_logs")
    op.drop_table("conspectus_review_logs")

    op.drop_index("ix_conspectus_events_conspectus_created", table_name="conspectus_events")
    op.drop_index("ix_conspectus_events_conspectus_uuid", table_name="conspectus_events")
    op.drop_table("conspectus_events")

    op.drop_index("ix_conspectus_schedules_owner_slot", table_name="conspectus_schedules")
    op.drop_index("ix_conspectus_schedules_owner_next_review", table_name="conspectus_schedules")
    op.drop_index("ix_conspectus_schedules_next_review_at", table_name="conspectus_schedules")
    op.drop_index("ix_conspectus_schedules_owner_client_uuid", table_name="conspectus_schedules")
    op.drop_table("conspectus_schedules")

    op.drop_index("ix_conspectuses_owner_created_desc", table_name="conspectuses")
    op.drop_index("ix_conspectuses_owner_client_uuid", table_name="conspectuses")
    op.drop_table("conspectuses")

    op.drop_table("schedule_policies")
