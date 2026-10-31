
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    BigInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    admin = "admin"
    developer = "developer"


class FindingSeverity(str, enum.Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"
    informational = "Informational"


class FindingStatus(str, enum.Enum):
    open = "Open"
    in_progress = "In Progress"
    in_review = "In Review"
    resolved = "Resolved"
    reopened = "Reopened"
    rejected = "Rejected"
    closed = "Closed"


USER_ROLE_ENUM = Enum(UserRole, name="user_role")
FINDING_SEVERITY_ENUM = Enum(FindingSeverity, name="finding_severity")
FINDING_STATUS_ENUM = Enum(FindingStatus, name="finding_status")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        USER_ROLE_ENUM, nullable=False, default=UserRole.developer
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index("uq_users_email_lower", func.lower(email), unique=True),
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    project_lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    # The project lead must be a member, enforced by the service layer.
    members = relationship(
        "ProjectMember",
        back_populates="project",
        cascade="all, delete-orphan",
        foreign_keys="ProjectMember.project_id",
    )
    repositories = relationship("Repository", back_populates="project")
    findings = relationship(
        "Finding",
        back_populates="project",
        foreign_keys="Finding.project_id",
        primaryjoin="Project.id == Finding.project_id",
    )


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True,
    )
    added_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member_pair"),
    )

    project = relationship(
        "Project", back_populates="members", foreign_keys=[project_id]
    )
    user = relationship("User", foreign_keys=[user_id])


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    repository_url: Mapped[str | None] = mapped_column(Text)
    branch_name: Mapped[str | None] = mapped_column(String(255))
    technology: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    project = relationship("Project", back_populates="repositories")

    __table_args__ = (
        UniqueConstraint("project_id", "id", name="uq_repository_project_id"),
        Index("ix_repositories_project_id", "project_id"),
    )


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    finding_code: Mapped[str] = mapped_column(
        String(30), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    branch_name: Mapped[str | None] = mapped_column(String(255))
    severity: Mapped[FindingSeverity] = mapped_column(
        FINDING_SEVERITY_ENUM, nullable=False
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[FindingStatus] = mapped_column(
        FINDING_STATUS_ENUM, nullable=False, default=FindingStatus.open
    )
    assignee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    due_date: Mapped[object] = mapped_column(Date, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "repository_id"],
            ["repositories.project_id", "repositories.id"],
            name="fk_finding_repository_belongs_to_project",
            use_alter=True,
        ),
        Index("ix_findings_project_status", "project_id", "status"),
        Index("ix_findings_assignee_status", "assignee_id", "status"),
        Index("ix_findings_due_date", "due_date"),
    )

    project = relationship(
        "Project",
        back_populates="findings",
        foreign_keys=[project_id],
        primaryjoin="Project.id == Finding.project_id",
    )
    repository = relationship("Repository", foreign_keys=[repository_id])
    feedback = relationship("FindingFeedback", back_populates="finding")
    work_history = relationship("FindingWorkHistory", back_populates="finding")
    status_history = relationship(
        "FindingStatusHistory", back_populates="finding"
    )
    attachments = relationship("FindingAttachment", back_populates="finding")


class FindingFeedback(Base):
    __tablename__ = "finding_feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    parent_feedback_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("finding_feedback.id")
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    finding = relationship("Finding", back_populates="feedback")
    author = relationship("User")
    parent = relationship("FindingFeedback", remote_side=[id], backref="replies")

    __table_args__ = (
        Index("ix_feedback_finding_created", "finding_id", "created_at"),
        Index("ix_feedback_parent", "parent_feedback_id"),
    )


class FindingWorkHistory(Base):
    __tablename__ = "finding_work_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    entry_type: Mapped[str] = mapped_column(String(30), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    finding = relationship("Finding", back_populates="work_history")
    author = relationship("User")

    __table_args__ = (
        Index("ix_work_history_finding_created", "finding_id", "created_at"),
    )


class FindingStatusHistory(Base):
    __tablename__ = "finding_status_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id"), nullable=False
    )
    old_status: Mapped[FindingStatus | None] = mapped_column(
        FINDING_STATUS_ENUM
    )
    new_status: Mapped[FindingStatus] = mapped_column(
        FINDING_STATUS_ENUM, nullable=False
    )
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    finding = relationship("Finding", back_populates="status_history")
    actor = relationship("User")

    __table_args__ = (
        Index("ix_status_history_finding_changed", "finding_id", "changed_at"),
    )


class FindingAttachment(Base):
    __tablename__ = "finding_attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id"), nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    media_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    attachment_kind: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    finding = relationship("Finding", back_populates="attachments")
    uploader = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "size_bytes > 0 AND size_bytes <= 10485760",
            name="ck_attachment_size_10mb",
        ),
    )


class FindingCodeCounter(Base):
    __tablename__ = "finding_code_counters"

    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint(
            "last_value >= 0",
            name="ck_finding_counter_nonnegative",
        ),
    )
