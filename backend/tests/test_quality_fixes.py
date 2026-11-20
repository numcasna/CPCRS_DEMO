import unittest
import uuid
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.dependencies import get_active_user
from app.config import settings
from app.core.media import detect_attachment_media_type
from app.database import SessionLocal
from app.models.entities import Finding, FindingAttachment, FindingStatus, FindingStatusHistory, Project, Repository, User
from app.schemas.repositories import RepositoryCreate, RepositoryResponse
from main import app
import seed


class TestQualityFixes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed.main()
        cls.client = TestClient(app)

    def _login(self, email: str, password: str) -> str:
        res = self.client.post("/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200)
        return res.json()["access_token"]

    def test_repository_schemas_exported_from_schemas_package(self):
        schema = RepositoryCreate(name="sample-repo")
        self.assertEqual(schema.name, "sample-repo")
        self.assertIn("id", RepositoryResponse.model_fields)

    def test_get_active_user_preserves_caller_status_codes(self):
        missing_id = uuid.uuid4()
        with SessionLocal() as db:
            with self.assertRaises(Exception) as ctx_404:
                get_active_user(missing_id, db)
            self.assertEqual(ctx_404.exception.status_code, 404)

            with self.assertRaises(Exception) as ctx_422:
                get_active_user(missing_id, db, not_found_status=422)
            self.assertEqual(ctx_422.exception.status_code, 422)

    def test_user_avatar_uses_configured_base_url(self):
        with SessionLocal() as db:
            dev = db.query(User).filter(User.email == "developer@example.com").one()
            avatar_path = Path(__file__).resolve().parents[1] / "uploads" / "avatars" / f"{dev.id}.png"
            avatar_path.parent.mkdir(parents=True, exist_ok=True)
            existed = avatar_path.exists()
            previous = avatar_path.read_bytes() if existed else None
            try:
                if not existed:
                    avatar_path.write_bytes(b"\x89PNG\r\n\x1a\n")
                with patch.object(settings, "base_url", "https://api.example.com/"):
                    self.assertTrue(dev.avatar.startswith("https://api.example.com/auth/avatar/"))
            finally:
                if existed:
                    avatar_path.write_bytes(previous)
                elif avatar_path.exists():
                    avatar_path.unlink()

    def test_contributions_includes_feedback_only_finding(self):
        admin_token = self._login("admin@example.com", "ChangeMe_Admin_123!")
        dev2_token = self._login("developer2@test.com", "Dev2Test@2026")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        dev2_headers = {"Authorization": f"Bearer {dev2_token}"}

        with SessionLocal() as db:
            project = db.query(Project).filter(Project.name == "Demo Code Review").one()
            repo = db.query(Repository).filter(Repository.project_id == project.id).first()
            dev1 = db.query(User).filter(User.email == "developer@example.com").one()
            dev2 = db.query(User).filter(User.email == "developer2@test.com").one()

        create_res = self.client.post(
            "/findings",
            headers=admin_headers,
            json={
                "title": "Feedback-only contribution lookup check",
                "description": "Created by admin, assigned to dev1, commented by dev2.",
                "project_id": str(project.id),
                "repository_id": str(repo.id),
                "severity": "Low",
                "category": "Maintainability",
                "assignee_id": str(dev1.id),
                "due_date": (date.today() + timedelta(days=5)).isoformat(),
            },
        )
        self.assertEqual(create_res.status_code, 201)
        finding_id = create_res.json()["id"]
        finding_code = create_res.json()["finding_code"]

        try:
            fb_res = self.client.post(
                f"/findings/{finding_id}/feedback",
                headers=dev2_headers,
                json={"body": "Dev2 reviewing finding"},
            )
            self.assertEqual(fb_res.status_code, 201)

            contrib_res = self.client.get(
                f"/users/{dev2.id}/contributions",
                headers=admin_headers,
            )
            self.assertEqual(contrib_res.status_code, 200)
            matching = [
                item
                for item in contrib_res.json()["timeline"]
                if item["finding_id"] == finding_id and item["type"] == "feedback"
            ]
            self.assertTrue(matching)
            self.assertEqual(matching[0]["finding_code"], finding_code)
            self.assertNotEqual(matching[0]["title"], "Finding unavailable")
        finally:
            with SessionLocal() as db:
                db.query(FindingStatusHistory).filter(
                    FindingStatusHistory.finding_id == uuid.UUID(finding_id)
                ).delete()
                finding = db.get(Finding, uuid.UUID(finding_id))
                if finding is not None:
                    for fb in list(finding.feedback):
                        db.delete(fb)
                    db.delete(finding)
                db.commit()

    def test_projects_list_default_vs_include_details(self):
        admin_token = self._login("admin@example.com", "ChangeMe_Admin_123!")
        headers = {"Authorization": f"Bearer {admin_token}"}

        default_res = self.client.get("/projects", headers=headers)
        self.assertEqual(default_res.status_code, 200)
        default_items = default_res.json()
        self.assertTrue(default_items)
        self.assertNotIn("members", default_items[0])
        self.assertNotIn("repositories", default_items[0])

        details_res = self.client.get("/projects?include_details=true", headers=headers)
        self.assertEqual(details_res.status_code, 200)
        detail_items = details_res.json()
        self.assertTrue(detail_items)
        self.assertIn("members", detail_items[0])
        self.assertIn("repositories", detail_items[0])
        for repo in detail_items[0]["repositories"]:
            self.assertTrue(repo["is_active"])

    def test_attachment_media_type_detection_ignores_spoofed_headers(self):
        self.assertEqual(
            detect_attachment_media_type(b"%PDF-1.7\n...", "report.pdf", "text/html"),
            "application/pdf",
        )
        self.assertEqual(
            detect_attachment_media_type(b"PK\x03\x04...", "notes.docx", "application/octet-stream"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.assertEqual(
            detect_attachment_media_type(b"plain log line\n", "app.log", "text/html"),
            "text/plain",
        )
        self.assertEqual(
            detect_attachment_media_type(b"\x00\x01\x02\x03", "evil.html", "text/html"),
            "application/octet-stream",
        )

    def test_upload_attachment_overrides_spoofed_content_type(self):
        admin_token = self._login("admin@example.com", "ChangeMe_Admin_123!")
        headers = {"Authorization": f"Bearer {admin_token}"}

        with SessionLocal() as db:
            project = db.query(Project).filter(Project.name == "Demo Code Review").one()
            repo = db.query(Repository).filter(Repository.project_id == project.id).first()
            dev1 = db.query(User).filter(User.email == "developer@example.com").one()

        create_res = self.client.post(
            "/findings",
            headers=headers,
            json={
                "title": "Attachment MIME detection check",
                "description": "Verify spoofed content-type is overridden by magic bytes.",
                "project_id": str(project.id),
                "repository_id": str(repo.id),
                "severity": "Low",
                "category": "Security",
                "assignee_id": str(dev1.id),
                "due_date": (date.today() + timedelta(days=5)).isoformat(),
            },
        )
        self.assertEqual(create_res.status_code, 201)
        finding_id = create_res.json()["id"]
        stored_path = None

        try:
            upload_res = self.client.post(
                f"/findings/{finding_id}/attachments",
                headers=headers,
                files={"file": ("evidence.pdf", b"%PDF-1.4\n%test", "text/html")},
                data={"attachment_kind": "evidence"},
            )
            self.assertEqual(upload_res.status_code, 201)
            self.assertEqual(upload_res.json()["media_type"], "application/pdf")

            with SessionLocal() as db:
                attachment = db.query(FindingAttachment).filter(
                    FindingAttachment.finding_id == uuid.UUID(finding_id)
                ).one()
                stored_path = (
                    Path(__file__).resolve().parents[1]
                    / "uploads"
                    / "findings"
                    / attachment.storage_key
                )
        finally:
            if stored_path is not None and stored_path.exists():
                stored_path.unlink()
            with SessionLocal() as db:
                db.query(FindingAttachment).filter(
                    FindingAttachment.finding_id == uuid.UUID(finding_id)
                ).delete()
                db.query(FindingStatusHistory).filter(
                    FindingStatusHistory.finding_id == uuid.UUID(finding_id)
                ).delete()
                finding = db.get(Finding, uuid.UUID(finding_id))
                if finding is not None:
                    db.delete(finding)
                db.commit()


if __name__ == "__main__":
    unittest.main()

