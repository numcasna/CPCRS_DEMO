# Shared findings and activity fix

This package includes these updates:

- Developer finding lists show all findings for projects the signed-in developer belongs to, not only findings assigned to them. The backend still enforces project membership.
- Developer finding detail pages load feedback, work-history entries, and status history from the same backend endpoints as the admin detail page.
- Assignment updates are persisted through the API instead of being local-only.
- Developers submit work as **In Review**; admins can resolve a finding.
- A forward Alembic migration restores the `in_review` PostgreSQL enum value if it was removed by the previous migration in this archive.

## Start locally

1. Start PostgreSQL using the backend `docker-compose.yml`.
2. In `backend`, create/activate a virtual environment, install `requirements.txt`, then run `python -m alembic upgrade head`.
3. Start the API with `python -m uvicorn main:app --reload`.
4. In `frontend/Cross_Project_Code_Review-main`, run `npm install` and `npm run dev`.

The frontend API base URL is currently `http://127.0.0.1:8000` in `src/api/client.js`; update it if the API runs elsewhere. The sample backend `.env` is for local development only.
