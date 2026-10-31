# CPCR Final Fixed Project Package

This package combines the shared-findings/activity work and the admin review workflow update.

## Included behavior
- Developers who are members of a project can view findings in that project, not just findings assigned to them.
- Finding detail pages use backend endpoints for feedback and history.
- Assignment updates are persisted through the backend API.
- The admin finding detail page includes Close Finding and Reassign Finding actions when status is In Review or Resolved.
- The backend status transition table permits In Review -> Closed.

## Run locally on Windows
1. Extract this ZIP to a new folder.
2. Start PostgreSQL using the setup your existing project uses. Do not reset an existing database.
3. In a terminal, go to `Cross_Project_Code_Review/backend`.
4. Create and activate a virtual environment, then install dependencies:
   - `python -m venv venv`
   - `venv\Scripts\Activate.ps1`
   - `python -m pip install -r requirements.txt`
5. Check `backend/.env` and ensure DATABASE_URL matches your PostgreSQL connection. The included `.env` values are local-development examples.
6. Start API: `python -m uvicorn main:app --reload`
7. In a second terminal, go to `frontend/Cross_Project_Code_Review-main`.
8. Run `npm install` then `npm run dev`.

## Admin workflow smoke test
1. Log in as an admin.
2. Open a finding with status `In Review`.
3. Verify the Admin review panel appears.
4. Try Close Finding, then confirm the status changes to `Closed`.
5. For a separate In Review finding, choose a valid member of that finding's project and click Reassign Finding.
6. Log in as a project developer and verify the finding/updated status is visible.

Do not run destructive database commands. Test with a non-critical finding first. This source package has not been validated against your local database or browser session, so verify the smoke test before treating it as production-ready.
