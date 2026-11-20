"""Restore the In Review finding status.

Revision ID: 0004_restore_in_review
Revises: 0003_remove_in_review
"""
from alembic import op

revision = "0004_restore_in_review"
down_revision = "0003_remove_in_review"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    op.execute("ALTER TYPE finding_status ADD VALUE IF NOT EXISTS 'in_review'")


def downgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    # PostgreSQL does not safely remove an enum value in-place. Keep it during downgrade.
    pass
