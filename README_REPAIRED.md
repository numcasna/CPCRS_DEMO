# CPCR Tracker — repaired package

This package preserves the supplied local backend/frontend and repairs the findings router, which in the uploaded ZIP contained only attachment routes. It restores the findings CRUD/status/history routes and adds the attachment endpoints used by the updated frontend.

## Start the application (Windows)

### 1. Start PostgreSQL
Open PowerShell:
```powershell
cd backend
docker compose up -d
```

### 2. Start the backend
Open a second PowerShell:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
API docs: http://127.0.0.1:8000/docs

### 3. Start the frontend
Open a third PowerShell:
```powershell
cd frontend\Cross_Project_Code_Review-main
npm install
npm run dev
```
Open the URL printed by Vite, usually http://localhost:5173.

## Important notes
- Do not run `alembic downgrade`, `git restore .`, or delete the database.
- Attachment uploads are limited to 10 MB per file and are stored locally under `backend/uploads/findings`.
- Keep the backend running while using the frontend.
- If your local PostgreSQL database already exists, do not recreate it. If the backend reports a database migration error, stop and share that exact error before running migrations.
- This package was syntax-checked for the repaired Python findings router. Full end-to-end execution against your Windows database and browser could not be run in this environment, so verify the app locally with the steps above.
