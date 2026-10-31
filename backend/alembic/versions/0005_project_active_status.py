"""Add persisted active/inactive state to projects.

Revision ID: 0005_project_active_status
Revises: 0004_restore_in_review
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_project_active_status"
down_revision = "0004_restore_in_review"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    if 'is_active' in [c['name'] for c in sa.inspect(conn).get_columns('projects')]:
        return
    op.add_column(
        "projects",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade():
    op.drop_column("projects", "is_active")
