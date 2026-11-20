# CPCR Frontend (React + Vite + TailwindCSS)

Web interface for the Cross-Project Code Review Finding Tracker, connected to the FastAPI backend.

## Setup

1. Optionally configure the API base URL (defaults to `http://127.0.0.1:8000`):

```bash
cp .env.example .env
```

2. Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://127.0.0.1:5173`).

3. Build for production:

```bash
npm run build
```

## Directory Structure

- `src/api/client.js` — Fetch wrapper (`apiRequest`, `apiRequestBlob`) with bearer token injection.
- `src/context/AuthContext.jsx` — Login, logout, password change, avatar updates, and tab-scoped session persistence.
- `src/context/DataContext.jsx` — Shared projects, users, findings, and custom finding-label state synced with the backend API.
- `src/pages/admin/*` — Admin views for projects, findings, creation, detail review, and developer profiles.
- `src/pages/user/*` — Developer views for assigned/project findings and project details.
- `src/components/*` & `src/layouts/*` — Shared UI components, badges, avatars, sidebars, and role-guarded layouts.
