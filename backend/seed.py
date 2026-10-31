"""Insert deterministic demo records after running Alembic.

Demo credentials:
  admin@example.com / ChangeMe_Admin_123!
  developer@example.com / ChangeMe_Dev_123!
  developer2@test.com / Dev2Test@2026

Change these immediately; this script is for local development only.
"""
from datetime import date
from sqlalchemy import select
from passlib.context import CryptContext
from app.database import SessionLocal
from app.models import User, Project, ProjectMember, Repository, Finding, FindingStatusHistory
from app.models.entities import UserRole, FindingSeverity, FindingStatus

pwd = CryptContext(schemes=["argon2"], deprecated="auto")

def main():
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.email == "admin@example.com"))
        dev = db.scalar(select(User).where(User.email == "developer@example.com"))
        dev2 = db.scalar(select(User).where(User.email == "developer2@test.com"))
        if admin is None:
            admin = User(name="Demo Admin", email="admin@example.com",
                         password_hash=pwd.hash("ChangeMe_Admin_123!"), role=UserRole.admin)
            db.add(admin)
        if dev is None:
            dev = User(name="Demo Developer", email="developer@example.com",
                       password_hash=pwd.hash("ChangeMe_Dev_123!"), role=UserRole.developer)
            db.add(dev)
        if dev2 is None:
            dev2 = User(name="Developer 2", email="developer2@test.com",
                        password_hash=pwd.hash("Dev2Test@2026"), role=UserRole.developer)
            db.add(dev2)
        db.flush()

        project = db.scalar(select(Project).where(Project.name == "Demo Code Review"))
        if project is None:
            project = Project(name="Demo Code Review",
                              description="Seed project for local development only.",
                              project_lead_id=dev.id, created_by=admin.id)
            db.add(project)
            db.flush()
        for uid in (admin.id, dev.id, dev2.id):
            if db.get(ProjectMember, (project.id, uid)) is None:
                db.add(ProjectMember(project_id=project.id, user_id=uid, added_by=admin.id))
        db.flush()

        repo = db.scalar(select(Repository).where(
            Repository.project_id == project.id, Repository.name == "demo-api"))
        if repo is None:
            repo = Repository(project_id=project.id, name="demo-api",
                              repository_url="https://example.com/demo-api",
                              branch_name="main", technology="Python/FastAPI")
            db.add(repo)
            db.flush()

        finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
        if finding is None:
            finding = Finding(finding_code="CRF-2026-0001",
                title="Validate request payload before processing",
                description="Demo finding: add server-side validation for malformed payloads.",
                project_id=project.id, repository_id=repo.id, branch_name="main",
                severity=FindingSeverity.medium, category="Input Validation",
                status=FindingStatus.open, assignee_id=dev.id, reviewer_id=None,
                created_by=admin.id, due_date=date(2026, 12, 31))
            db.add(finding)
            db.flush()
            db.add(FindingStatusHistory(finding_id=finding.id, old_status=None,
                new_status=FindingStatus.open, changed_by=admin.id,
                reason="Initial status at finding creation"))
        db.commit()
        print("Demo seed data inserted (or already present).")

if __name__ == "__main__":
    main()
