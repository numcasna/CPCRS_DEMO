# Cross-Project Code Review Finding Tracker (CPCR)

A collaborative code review finding and issue tracking platform for engineering teams across multiple projects and repositories.

---

## Quick Start (How to Run)

### 1. Backend Setup (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python3 seed.py
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
* **API Documentation**: http://127.0.0.1:8000/docs

### 2. Frontend Setup (React / Vite)
```bash
cd frontend/Cross_Project_Code_Review-main
npm install
npm run dev
```
* **Web UI**: http://127.0.0.1:5173

---

## Test Accounts & Credentials

| Role | Name | Email | Password |
|---|---|---|---|
| **Admin** | Demo Admin | `admin@example.com` | `ChangeMe_Admin_123!` |
| **Developer** | Demo Developer | `developer@example.com` | `ChangeMe_Dev_123!` |
| **Developer** | Developer 2 | `developer2@test.com` | `Dev2Test@2026` |

---

## Running Automated Tests

Run the backend unit and regression test suite (15 tests):
```bash
cd backend
python3 -m unittest test_seed.py
```

---

## Key Changes & Functionality Added

1. **Second Developer Account (`Developer 2`)**:
   - Seeded `developer2@test.com` (`Dev2Test@2026`) with full project membership for multi-user review workflows.
2. **Developer Profile & Contributions**:
   - Enabled developer access to member profile details and contribution timelines (`/users/{id}` & `/users/{id}/contributions`).
   - Added clickable developer chips navigating directly to profiles.
3. **Attachment Segregation & Modal Preview**:
   - Segregated initial issue evidence (**Admin Attachments**) from fix submission validation (**User Attachments**).
   - Added pop-up image & document modal preview with direct download.
4. **Admin Review (Close Finding & Reassignment)**:
   - Fixed permission checks allowing Admins to close findings from `In Review` and `Resolved` states.
   - Dedicated reassignment endpoint (`POST /findings/{id}/reassign`):
     - Allows reassigning to any project developer (including the currently assigned developer).
     - Allows providing feedback explaining why the finding was reassigned.
     - Automatically resets finding status to **Open**.
     - Automatically logs reassignment history and feedback notes in the timeline.
5. **Custom Finding Labels**:
   - Admins can type custom labels on the fly when creating a finding (`/admin/findings/new`) via inline toggle.
   - Centralized label management under Settings (`/admin/settings`) to view, add, or delete custom labels.
   - Custom labels automatically persist in local registry and sync across filters.
6. **Auth State Persistence**:
   - Persisted user profile in `localStorage` to prevent role and token desync on page reloads.

---

## Detailed Log
For line-by-line file changes and exact technical details, refer to [CHANGELOG.md](./CHANGELOG.md).
