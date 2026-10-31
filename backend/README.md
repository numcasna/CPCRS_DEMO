# Cross-Project Code Review Finding Tracker — Database Starter

PostgreSQL + SQLAlchemy 2.x + Alembic. This package sets up the database schema and optional demo records. It is not the complete FastAPI business API yet.

## Included
- Nine logical tables from the approved schema: users, projects, project_members, repositories, findings, finding_feedback, finding_work_history, finding_status_history, finding_attachments.
- `finding_code_counters`, an additional implementation table for transaction-safe yearly finding-code allocation.
- PostgreSQL enums/check constraints, indexes, foreign keys, UTC-aware timestamps, soft-delete fields.
- Alembic initial revision, `.env.example`, Docker Compose PostgreSQL, and an idempotent demo seed script.

## 1. Start PostgreSQL
Install Docker Desktop, then run:
```bash
docker compose up -d postgres
```
Copy `.env.example` to `.env`. Change the database password consistently in `docker-compose.yml` and `.env` before use.

## 2. Install Python dependencies
Python 3.11+ recommended:
```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Create tables with Alembic
```bash
alembic upgrade head
```
This is the supported table-creation path. Do not manually create tables in PostgreSQL. Future changes should be new Alembic revisions.

## 4. Optional demo seed data
```bash
python seed.py
```
Demo login credentials are in `seed.py`; this script is for local development only. Do not use those credentials in a deployed environment. Seed records are illustrative, not real project data.

## 5. Inspect migration status
```bash
alembic current
alembic history
```

## Important implementation notes
- Account provisioning is admin-created only; public self-registration is out of scope.
- Only roles `admin` and `developer` are modeled.
- Passwords in the seed script are hashed with Argon2; plaintext is never stored.
- Project lead membership is enforced in application service logic because creating a project and its first membership is a cyclic relationship.
- A finding's repository must belong to its project; the composite foreign key enforces this.
- The exact category vocabulary, status-transition map, reviewer assignment policy, soft-delete cascade/retention policy, feedback-edit policy, and production attachment storage are still unresolved in the source schema. Finalize these before production. `seed.py` uses `Input Validation` only as a demo category.
- Attachments are metadata-only in PostgreSQL. The backend should validate actual JPG/PDF/TXT file content and enforce the 10 MB limit, and store bytes in a private `uploads/` directory during development.
- The database layer does not yet implement FastAPI endpoints, authorization policies, or the transactional status/code-generation services. Those belong in the next backend layer.


## Project lifecycle controls (MVP 21 update)

- Project active/inactive state is persisted in PostgreSQL using `projects.is_active`. Admins can change it through `PATCH /projects/{project_id}/status` with `{ "is_active": false }` or `true`.
- Soft delete uses `DELETE /projects/{project_id}` and writes `deleted_at`; it does not physically delete the project, repositories, members, or findings.
- Admins can view deleted projects with `GET /projects?include_deleted=true` and restore one with `POST /projects/{project_id}/restore`.
- Developer project and finding access is restricted to active, non-deleted projects. Admins retain visibility of inactive projects and can restore deleted projects.
- Apply the new database migration from the backend directory with `alembic upgrade head`.
