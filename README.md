# Cross-Project Code Review Finding Tracker (CPCR)

A collaborative code review finding and issue tracking platform for engineering teams across multiple projects and repositories, built with **FastAPI**, **PostgreSQL / SQLAlchemy**, and **React (Vite + TailwindCSS)**.

**Team:** Khushi, Yash, Nitin, Tanmay, Saloni

---

## Architecture Overview

- **Backend (`backend/`)**: FastAPI REST API with JWT authentication (`Argon2` password hashing), role-based access (`admin`, `developer`), SQLAlchemy 2.0 ORM, Alembic migrations, and local file storage for avatars and finding attachments.
- **Frontend (`frontend/Cross_Project_Code_Review-main/`)**: React 18 SPA with Vite, React Router, Recharts, TailwindCSS, and tab-isolated session auth (`sessionStorage`).

---

## Quick Start

### 1. Backend Setup (FastAPI)

```bash
cd backend
cp .env.example .env   # update DATABASE_URL and JWT_SECRET_KEY as needed

# Optional: start PostgreSQL with Docker Compose
# docker compose up -d postgres

python3 -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python3 seed.py
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- **API Docs (Swagger):** `http://127.0.0.1:8000/docs`
- **File Uploads:** Finding attachments support up to 10 MB per file and are stored under `backend/uploads/findings`.

### 2. Frontend Setup (React / Vite)

```bash
cd frontend/Cross_Project_Code_Review-main
cp .env.example .env   # optional, defaults to http://127.0.0.1:8000
npm install
npm run dev
```

- **Web UI:** `http://127.0.0.1:5173`

---

## Demo Accounts

Seeded by `backend/seed.py` for local development:

| Role | Name | Email | Password |
|---|---|---|---|
| **Admin** | Demo Admin | `admin@example.com` | `ChangeMe_Admin_123!` |
| **Developer** | Demo Developer | `developer@example.com` | `ChangeMe_Dev_123!` |
| **Developer** | Developer 2 | `developer2@test.com` | `Dev2Test@2026` |

---

## Core Features

- **Project & Repository Management:** Create projects with leads, members, and repositories; toggle active status; soft-delete and restore projects.
- **Finding Lifecycle & Assignment:** Create, filter, update, and reassign findings with yearly sequential codes (`FND-YYYY-NNNN`), status transition rules, and tracked assigned/accepted timestamps.
- **Collaboration & Evidence:** Threaded feedback, developer work-history entries, status history timeline, and role-segregated attachment uploads with modal preview and authenticated downloads.
- **Profiles & Analytics:** Developer contribution workloads, resolution metrics, password updates, and persistent profile pictures.

---

## Running Tests

```bash
cd backend
python3 -m unittest test_seed.py
python3 -m unittest discover -s tests -v
```
