# Admin review actions fix

This update restores the admin actions for findings with status `In Review` and allows the backend transition `In Review` -> `Closed`.

Files changed:
- `frontend/Cross_Project_Code_Review-main/src/pages/admin/FindingDetail.jsx`
- `backend/app/api/routes/findings.py`

To apply to an existing extracted project, replace those two files with the matching files from this archive. Restart the backend after replacing `findings.py` (Uvicorn `--reload` usually restarts automatically). No database migration is required for these changes.

The frontend build was not verified in this environment because frontend dependencies were not installed here. Backend Python syntax compilation passed.
