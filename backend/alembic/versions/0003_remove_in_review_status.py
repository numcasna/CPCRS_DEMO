
"""Remove In Review from finding status enum."""

from alembic import op

revision = "0003_remove_in_review"
down_revision = "0002_add_in_review"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    # Map existing findings using In Review to In Progress.
    op.execute("""
        UPDATE findings
        SET status = 'in_progress'
        WHERE status::text = 'in_review'
    """)

    # Preserve the history table's structure while translating the
    # obsolete enum value to the closest remaining workflow status.
    op.execute("""
        UPDATE finding_status_history
        SET old_status = 'in_progress'
        WHERE old_status::text = 'in_review'
    """)
    op.execute("""
        UPDATE finding_status_history
        SET new_status = 'in_progress'
        WHERE new_status::text = 'in_review'
    """)

    # Temporarily convert enum columns to text so the old enum can
    # be removed and recreated without In Review.
    op.execute("""
        ALTER TABLE findings
        ALTER COLUMN status TYPE text USING status::text
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN old_status TYPE text
        USING old_status::text
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN new_status TYPE text
        USING new_status::text
    """)

    op.execute("DROP TYPE finding_status")

    op.execute("""
        CREATE TYPE finding_status AS ENUM (
            'open',
            'in_progress',
            'resolved',
            'reopened',
            'rejected',
            'closed'
        )
    """)

    op.execute("""
        ALTER TABLE findings
        ALTER COLUMN status TYPE finding_status
        USING status::finding_status
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN old_status TYPE finding_status
        USING old_status::finding_status
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN new_status TYPE finding_status
        USING new_status::finding_status
    """)


def downgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    # Restore the previous enum definition.
    op.execute("""
        ALTER TABLE findings
        ALTER COLUMN status TYPE text USING status::text
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN old_status TYPE text
        USING old_status::text
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN new_status TYPE text
        USING new_status::text
    """)

    op.execute("DROP TYPE finding_status")

    op.execute("""
        CREATE TYPE finding_status AS ENUM (
            'open',
            'in_progress',
            'in_review',
            'resolved',
            'reopened',
            'rejected',
            'closed'
        )
    """)

    op.execute("""
        ALTER TABLE findings
        ALTER COLUMN status TYPE finding_status
        USING status::finding_status
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN old_status TYPE finding_status
        USING old_status::finding_status
    """)
    op.execute("""
        ALTER TABLE finding_status_history
        ALTER COLUMN new_status TYPE finding_status
        USING new_status::finding_status
    """)
