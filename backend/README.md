# CPCR Backend (FastAPI + SQLAlchemy + Alembic)

REST API and database layer for the Cross-Project Code Review Finding Tracker.

## Stack

- FastAPI + Uvicorn
- SQLAlchemy 2.x + Alembic
- PostgreSQL (`psycopg[binary]`) / SQLite for local testing
- JWT authentication (`python-jose`) + Argon2 password hashing (`passlib[argon2]`)

## Setup

### 1. Configure Environment

```bash
cp .env.example .env
```

Update `DATABASE_URL`, `JWT_SECRET_KEY`, and `BASE_URL` in `.env` as needed.

### 2. Start PostgreSQL (Optional via Docker)

```bash
docker compose up -d postgres
```

### 3. Install Dependencies & Run Migrations

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python3 seed.py
```

### 4. Start the API Server

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

## Project Structure

- `main.py` — FastAPI application setup, CORS middleware, router registration, `/health` check.
- `app/config.py` — Pydantic settings loaded from `.env`.
- `app/models/entities.py` — SQLAlchemy models (`User`, `Project`, `ProjectMember`, `Repository`, `Finding`, `FindingFeedback`, `FindingWorkHistory`, `FindingStatusHistory`, `FindingAttachment`, `FindingCodeCounter`).
- `app/schemas/` — Pydantic request/response schemas.
- `app/api/routes/` — Route modules (`auth.py`, `projects.py`, `repositories.py`, `users.py`, `findings/`).
- `app/core/` — Password hashing/JWT helpers (`security.py`) and magic-byte media detection (`media.py`).
- `alembic/` — Database migration scripts.

## Running Tests

```bash
python3 -m unittest test_seed.py
python3 -m unittest discover -s tests -v
```
