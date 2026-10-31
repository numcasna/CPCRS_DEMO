# CPCR attachment and admin workflow update

This update package is based on the project ZIP supplied in chat.

## Included changes
- Backend `findings.py` includes attachment upload/list/download endpoints and normal findings routes.
- Admin `FindingDetail.jsx` loads persisted attachment metadata and provides authenticated downloads.
- When a finding is Resolved, the admin detail page shows Close Finding and Reassign Finding actions.
- The frontend API client supports FormData and authenticated blob downloads.

## Important
This package has not been tested against the user's live PostgreSQL database or browser session. Keep the existing project and database unchanged until testing succeeds.
Attachments require `python-multipart` in the backend environment and a database table `finding_attachments` matching the existing SQLAlchemy model.
