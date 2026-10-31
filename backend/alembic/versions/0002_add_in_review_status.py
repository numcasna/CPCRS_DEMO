"""Add In Review to finding status enum."""

from alembic import op

revision = "0002_add_in_review"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    op.execute(
        "ALTER TYPE finding_status ADD VALUE IF NOT EXISTS 'in_review'"
    )


def downgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    # PostgreSQL does not directly support removing an enum value.
    # Keep this value during downgrade rather than risking data loss.
    pass