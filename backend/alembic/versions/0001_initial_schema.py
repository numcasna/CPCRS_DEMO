"""Initial Cross-Project Finding Tracker schema.

Revision ID: 0001_initial
Revises:
"""
from alembic import op
from app.database import Base
from app import models  # registers metadata

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Initial migration creates the complete SQLAlchemy metadata in dependency order.
    # Subsequent schema changes should use normal Alembic operations/autogeneration.
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=False)

def downgrade():
    Base.metadata.drop_all(bind=op.get_bind(), checkfirst=False)
