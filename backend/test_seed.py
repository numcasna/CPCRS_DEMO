import unittest
from sqlalchemy import select
from passlib.context import CryptContext
from app.database import SessionLocal
from app.models import User, Project, ProjectMember
from app.models.entities import UserRole
import seed

pwd = CryptContext(schemes=["argon2"], deprecated="auto")

class TestSeedDeveloper2(unittest.TestCase):
    def test_developer2_is_seeded(self):
        # Run the seed function
        seed.main()

        with SessionLocal() as db:
            dev2 = db.scalar(select(User).where(User.email == "developer2@test.com"))
            self.assertIsNotNone(dev2, "developer2@test.com was not created in the database")
            self.assertEqual(dev2.role, UserRole.developer)
            self.assertTrue(pwd.verify("Dev2Test@2026", dev2.password_hash), "Password verification failed for Developer 2")

            # Check project membership so Developer 2 can access the demo project
            project = db.scalar(select(Project).where(Project.name == "Demo Code Review"))
            self.assertIsNotNone(project, "Project 'Demo Code Review' must exist")
            membership = db.get(ProjectMember, (project.id, dev2.id))
            self.assertIsNotNone(membership, "developer2 must be a member of 'Demo Code Review'")

    def test_existing_seed_users_remain_intact(self):
        seed.main()

        with SessionLocal() as db:
            admin = db.scalar(select(User).where(User.email == "admin@example.com"))
            self.assertIsNotNone(admin)
            self.assertTrue(pwd.verify("ChangeMe_Admin_123!", admin.password_hash))

            dev1 = db.scalar(select(User).where(User.email == "developer@example.com"))
            self.assertIsNotNone(dev1)
            self.assertTrue(pwd.verify("ChangeMe_Dev_123!", dev1.password_hash))

    def test_developer2_api_login(self):
        from fastapi.testclient import TestClient
        from main import app
        client = TestClient(app)
        response = client.post("/auth/login", json={
            "email": "developer2@test.com",
            "password": "Dev2Test@2026"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["email"], "developer2@test.com")
        self.assertEqual(data["user"]["role"], "developer")

    def test_developer_can_view_member_profile_and_contributions(self):
        from fastapi.testclient import TestClient
        from main import app
        client = TestClient(app)
        # Login as developer
        login_res = client.post("/auth/login", json={
            "email": "developer@example.com",
            "password": "ChangeMe_Dev_123!"
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Query developer2 profile
        with SessionLocal() as db:
            dev2 = db.scalar(select(User).where(User.email == "developer2@test.com"))
            dev2_id = str(dev2.id)

        profile_res = client.get(f"/users/{dev2_id}", headers=headers)
        self.assertEqual(profile_res.status_code, 200, f"Expected 200 for profile, got {profile_res.status_code}: {profile_res.text}")
        self.assertEqual(profile_res.json()["email"], "developer2@test.com")

        contrib_res = client.get(f"/users/{dev2_id}/contributions", headers=headers)
        self.assertEqual(contrib_res.status_code, 200, f"Expected 200 for contributions, got {contrib_res.status_code}: {contrib_res.text}")
        contrib_data = contrib_res.json()
        self.assertIn("workload", contrib_data)
        self.assertIn("timeline", contrib_data)

    def test_attachment_uploader_info_and_segregation(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding
        from main import app
        import io

        client = TestClient(app)

        # Login as developer
        dev_res = client.post("/auth/login", json={
            "email": "developer@example.com",
            "password": "ChangeMe_Dev_123!"
        })
        self.assertEqual(dev_res.status_code, 200)
        dev_token = dev_res.json()["access_token"]
        dev_headers = {"Authorization": f"Bearer {dev_token}"}

        # Find finding in Demo Code Review
        with SessionLocal() as db:
            finding = db.scalar(select(Finding))
            self.assertIsNotNone(finding)
            finding_id = str(finding.id)

        # Upload an attachment as developer
        file_content = b"fake image content"
        files = {"file": ("developer_screenshot.png", io.BytesIO(file_content), "image/png")}
        data = {"attachment_kind": "resolution"}

        upload_res = client.post(
            f"/findings/{finding_id}/attachments",
            headers=dev_headers,
            files=files,
            data=data
        )
        self.assertEqual(upload_res.status_code, 201, f"Upload failed: {upload_res.text}")
        upload_data = upload_res.json()

        # Assert uploader role and name are included in metadata
        self.assertIn("uploader_role", upload_data)
        self.assertEqual(upload_data["uploader_role"], "developer")
        self.assertIn("uploader_name", upload_data)
        self.assertEqual(upload_data["uploader_name"], "Demo Developer")

        # Fetch attachments list and verify segregation fields exist
        list_res = client.get(f"/findings/{finding_id}/attachments", headers=dev_headers)
        self.assertEqual(list_res.status_code, 200)
        attachments = list_res.json()
        self.assertGreater(len(attachments), 0)
        for att in attachments:
            self.assertIn("uploader_role", att)

    def test_developer_can_accept_open_finding(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding, FindingStatus
        from main import app

        client = TestClient(app)

        # Login as developer
        dev_res = client.post("/auth/login", json={
            "email": "developer@example.com",
            "password": "ChangeMe_Dev_123!"
        })
        self.assertEqual(dev_res.status_code, 200)
        dev_token = dev_res.json()["access_token"]
        dev_headers = {"Authorization": f"Bearer {dev_token}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            self.assertIsNotNone(finding)
            finding.status = FindingStatus.open
            db.commit()
            finding_id = str(finding.id)

        # Accept finding (Open -> In Progress)
        accept_res = client.patch(
            f"/findings/{finding_id}/status",
            headers=dev_headers,
            json={"status": "In Progress"}
        )
        self.assertEqual(accept_res.status_code, 200)
        self.assertEqual(accept_res.json()["status"], "In Progress")

        # History should contain In Progress with valid timestamp
        history_res = client.get(f"/findings/{finding_id}/history", headers=dev_headers)
        self.assertEqual(history_res.status_code, 200)
        history_entries = history_res.json()
        in_progress_entries = [h for h in history_entries if h["new_status"] == "In Progress"]
        self.assertGreater(len(in_progress_entries), 0)
        self.assertIsNotNone(in_progress_entries[0]["changed_at"])

    def test_demo_developer_attachment_submission_and_segregation(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding
        from main import app
        import io

        client = TestClient(app)

        # Login as demo developer
        dev_res = client.post("/auth/login", json={
            "email": "developer@example.com",
            "password": "ChangeMe_Dev_123!"
        })
        self.assertEqual(dev_res.status_code, 200)
        dev_token = dev_res.json()["access_token"]
        dev_headers = {"Authorization": f"Bearer {dev_token}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            self.assertIsNotNone(finding)
            finding_id = str(finding.id)

        # Demo Developer submits a resolution attachment
        file_content = b"demo developer fix evidence"
        files = {"file": ("demo_developer_fix.png", io.BytesIO(file_content), "image/png")}
        data = {"attachment_kind": "resolution"}

        upload_res = client.post(
            f"/findings/{finding_id}/attachments",
            headers=dev_headers,
            files=files,
            data=data
        )
        self.assertEqual(upload_res.status_code, 201)
        upload_data = upload_res.json()

        # Assert uploader role and name correctly map to Demo Developer
        self.assertEqual(upload_data["uploader_role"], "developer")
        self.assertEqual(upload_data["uploader_name"], "Demo Developer")
        self.assertEqual(upload_data["attachment_kind"], "resolution")

        # Segregation classification rule:
        # User attachment if attachment_kind == 'resolution' OR uploader_role == 'developer'
        is_user_attachment = (
            upload_data.get("attachment_kind") == "resolution"
            or upload_data.get("uploader_role") == "developer"
        )
        self.assertTrue(is_user_attachment, "Demo developer attachment must classify as a user attachment")

    def test_admin_can_close_in_review_finding(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding, FindingStatus
        from main import app

        client = TestClient(app)

        admin_res = client.post("/auth/login", json={
            "email": "admin@example.com",
            "password": "ChangeMe_Admin_123!"
        })
        self.assertEqual(admin_res.status_code, 200)
        admin_token = admin_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            self.assertIsNotNone(finding)
            finding.status = FindingStatus.in_review
            db.commit()
            finding_id = str(finding.id)

        close_res = client.patch(
            f"/findings/{finding_id}/status",
            headers=admin_headers,
            json={"status": "Closed"}
        )
        self.assertEqual(close_res.status_code, 200)
        self.assertEqual(close_res.json()["status"], "Closed")

    def test_admin_can_reassign_finding_with_feedback_and_status_becomes_open(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding, FindingStatus, User
        from main import app

        client = TestClient(app)

        admin_res = client.post("/auth/login", json={
            "email": "admin@example.com",
            "password": "ChangeMe_Admin_123!"
        })
        self.assertEqual(admin_res.status_code, 200)
        admin_token = admin_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            self.assertIsNotNone(finding)
            dev2 = db.scalar(select(User).where(User.email == "developer2@test.com"))
            self.assertIsNotNone(dev2)
            finding.status = FindingStatus.in_review
            db.commit()
            finding_id = str(finding.id)
            dev2_id = str(dev2.id)

        # Admin reassigns finding to dev2 with feedback
        reassign_res = client.post(
            f"/findings/{finding_id}/reassign",
            headers=admin_headers,
            json={
                "assignee_id": dev2_id,
                "feedback": "Needs additional input validation on boundary conditions"
            }
        )
        self.assertEqual(reassign_res.status_code, 200)
        data = reassign_res.json()
        self.assertEqual(data["status"], "Open")
        self.assertEqual(data["assignee_id"], dev2_id)

        # Check status history
        hist_res = client.get(f"/findings/{finding_id}/history", headers=admin_headers)
        self.assertEqual(hist_res.status_code, 200)
        latest_hist = hist_res.json()[-1]
        self.assertEqual(latest_hist["new_status"], "Open")
        self.assertIn("Reassigned", latest_hist["reason"])

        # Check feedback thread
        fb_res = client.get(f"/findings/{finding_id}/feedback", headers=admin_headers)
        self.assertEqual(fb_res.status_code, 200)
        feedback_bodies = [fb["body"] for fb in fb_res.json()]
        self.assertTrue(any("boundary conditions" in b for b in feedback_bodies))

    def test_admin_can_reassign_to_same_developer(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding, FindingStatus, User
        from main import app

        client = TestClient(app)

        admin_res = client.post("/auth/login", json={
            "email": "admin@example.com",
            "password": "ChangeMe_Admin_123!"
        })
        self.assertEqual(admin_res.status_code, 200)
        admin_token = admin_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            self.assertIsNotNone(finding)
            dev1 = db.scalar(select(User).where(User.email == "developer@example.com"))
            finding.status = FindingStatus.in_review
            finding.assignee_id = dev1.id
            db.commit()
            finding_id = str(finding.id)
            dev1_id = str(dev1.id)

        # Reassign to same developer
        reassign_res = client.post(
            f"/findings/{finding_id}/reassign",
            headers=admin_headers,
            json={
                "assignee_id": dev1_id,
                "feedback": "Please re-check with same developer"
            }
        )
        self.assertEqual(reassign_res.status_code, 200)
        data = reassign_res.json()
        self.assertEqual(data["status"], "Open")
        self.assertEqual(data["assignee_id"], dev1_id)

    def test_non_admin_cannot_reassign(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding, User
        from main import app

        client = TestClient(app)

        dev_res = client.post("/auth/login", json={
            "email": "developer@example.com",
            "password": "ChangeMe_Dev_123!"
        })
        self.assertEqual(dev_res.status_code, 200)
        dev_token = dev_res.json()["access_token"]
        dev_headers = {"Authorization": f"Bearer {dev_token}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            finding_id = str(finding.id)
            dev2 = db.scalar(select(User).where(User.email == "developer2@test.com"))
            dev2_id = str(dev2.id)

        res = client.post(
            f"/findings/{finding_id}/reassign",
            headers=dev_headers,
            json={"assignee_id": dev2_id, "feedback": "Attempted reassignment"}
        )
        self.assertEqual(res.status_code, 403)

    def test_admin_can_close_resolved_finding(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding, FindingStatus
        from main import app

        client = TestClient(app)
        admin_res = client.post("/auth/login", json={
            "email": "admin@example.com",
            "password": "ChangeMe_Admin_123!"
        })
        self.assertEqual(admin_res.status_code, 200)
        admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            finding.status = FindingStatus.resolved
            db.commit()
            finding_id = str(finding.id)

        close_res = client.patch(
            f"/findings/{finding_id}/status",
            headers=admin_headers,
            json={"status": "Closed"}
        )
        self.assertEqual(close_res.status_code, 200)
        self.assertEqual(close_res.json()["status"], "Closed")

    def test_attachment_download_and_preview_bytes(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Finding
        from main import app
        import io

        client = TestClient(app)
        dev_res = client.post("/auth/login", json={
            "email": "developer@example.com",
            "password": "ChangeMe_Dev_123!"
        })
        dev_headers = {"Authorization": f"Bearer {dev_res.json()['access_token']}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            finding_id = str(finding.id)

        # Upload a test file
        upload_content = b"sample image bytes for preview"
        files = {"file": ("test_preview.png", io.BytesIO(upload_content), "image/png")}
        data = {"attachment_kind": "resolution"}

        up_res = client.post(f"/findings/{finding_id}/attachments", headers=dev_headers, files=files, data=data)
        self.assertEqual(up_res.status_code, 201)
        att_id = up_res.json()["id"]

        # Download / preview file
        dl_res = client.get(f"/findings/{finding_id}/attachments/{att_id}/download", headers=dev_headers)
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(dl_res.content, upload_content)

    def test_full_finding_lifecycle_reassignment_and_closure(self):
        """
        Validates entire user flow:
        1. Open -> In Progress (Dev 1 accepts)
        2. In Progress -> In Review (Dev 1 submits fix)
        3. In Review -> Reassigned to Dev 2 with Feedback (Admin reassigns, status becomes Open)
        4. Open -> In Progress (Dev 2 accepts work)
        5. In Progress -> In Review (Dev 2 submits fix)
        6. In Review -> Closed (Admin closes)
        """
        from fastapi.testclient import TestClient
        from app.models.entities import Finding, FindingStatus, User
        from main import app

        client = TestClient(app)

        # 1. Login all users
        admin_auth = client.post("/auth/login", json={"email": "admin@example.com", "password": "ChangeMe_Admin_123!"}).json()
        dev1_auth = client.post("/auth/login", json={"email": "developer@example.com", "password": "ChangeMe_Dev_123!"}).json()
        dev2_auth = client.post("/auth/login", json={"email": "developer2@test.com", "password": "Dev2Test@2026"}).json()

        admin_h = {"Authorization": f"Bearer {admin_auth['access_token']}"}
        dev1_h = {"Authorization": f"Bearer {dev1_auth['access_token']}"}
        dev2_h = {"Authorization": f"Bearer {dev2_auth['access_token']}"}

        with SessionLocal() as db:
            finding = db.scalar(select(Finding).where(Finding.finding_code == "CRF-2026-0001"))
            dev1 = db.scalar(select(User).where(User.email == "developer@example.com"))
            dev2 = db.scalar(select(User).where(User.email == "developer2@test.com"))
            finding.status = FindingStatus.open
            finding.assignee_id = dev1.id
            db.commit()
            fid = str(finding.id)
            d2_id = str(dev2.id)

        # Step 1: Dev 1 accepts (Open -> In Progress)
        s1 = client.patch(f"/findings/{fid}/status", headers=dev1_h, json={"status": "In Progress"})
        self.assertEqual(s1.status_code, 200)
        self.assertEqual(s1.json()["status"], "In Progress")

        # Step 2: Dev 1 submits for review (In Progress -> In Review)
        s2 = client.patch(f"/findings/{fid}/status", headers=dev1_h, json={"status": "In Review"})
        self.assertEqual(s2.status_code, 200)
        self.assertEqual(s2.json()["status"], "In Review")

        # Step 3: Admin reassigns to Dev 2 with feedback (Status reverts to Open)
        s3 = client.post(f"/findings/{fid}/reassign", headers=admin_h, json={
            "assignee_id": d2_id,
            "feedback": "Needs extra validation logic."
        })
        self.assertEqual(s3.status_code, 200)
        self.assertEqual(s3.json()["status"], "Open")
        self.assertEqual(s3.json()["assignee_id"], d2_id)

        # Step 4: Dev 2 accepts (Open -> In Progress)
        s4 = client.patch(f"/findings/{fid}/status", headers=dev2_h, json={"status": "In Progress"})
        self.assertEqual(s4.status_code, 200)
        self.assertEqual(s4.json()["status"], "In Progress")

        # Step 5: Dev 2 submits fix (In Progress -> In Review)
        s5 = client.patch(f"/findings/{fid}/status", headers=dev2_h, json={"status": "In Review"})
        self.assertEqual(s5.status_code, 200)
        self.assertEqual(s5.json()["status"], "In Review")

        # Step 6: Admin closes finding (In Review -> Closed)
        s6 = client.patch(f"/findings/{fid}/status", headers=admin_h, json={"status": "Closed"})
        self.assertEqual(s6.status_code, 200)
        self.assertEqual(s6.json()["status"], "Closed")

    def test_admin_create_finding_with_custom_label(self):
        from fastapi.testclient import TestClient
        from app.models.entities import Project, Repository, User
        from main import app

        client = TestClient(app)
        admin_auth = client.post("/auth/login", json={"email": "admin@example.com", "password": "ChangeMe_Admin_123!"}).json()
        admin_h = {"Authorization": f"Bearer {admin_auth['access_token']}"}

        with SessionLocal() as db:
            project = db.scalar(select(Project).where(Project.name == "Demo Code Review"))
            repo = db.scalar(select(Repository).where(Repository.project_id == project.id))
            dev = db.scalar(select(User).where(User.email == "developer@example.com"))
            pid = str(project.id)
            rid = str(repo.id)
            did = str(dev.id)

        custom_label = "Zero-Day Memory Safety Hazard"
        payload = {
            "title": "Custom Label Finding Test",
            "description": "Testing custom label creation support.",
            "project_id": pid,
            "repository_id": rid,
            "severity": "High",
            "category": custom_label,
            "assignee_id": did,
            "due_date": "2026-11-30"
        }

        create_res = client.post("/findings", headers=admin_h, json=payload)
        self.assertEqual(create_res.status_code, 201)
        created_data = create_res.json()
        self.assertEqual(created_data["category"], custom_label)

        # Retrieve finding
        get_res = client.get(f"/findings/{created_data['id']}", headers=admin_h)
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["category"], custom_label)

if __name__ == "__main__":
    unittest.main()

