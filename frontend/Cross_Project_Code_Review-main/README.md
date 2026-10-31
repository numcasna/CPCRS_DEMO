# Cross Project Code Review Finding Tracker

Dailoqa Team Project

## Team

* Khushi
* Yash
* Nitin
* Tanmay
* Saloni

## Project

A centralized system for tracking code review findings across multiple projects and repositories.

# CR Tracker — Frontend (React)

Frontend-only prototype for the Cross-Project Code Review Finding Tracker.

No backend, no database — all data lives in `src/data/mockData.js` and in memory while the app is running.

## Run it

```bash
npm install

npm run dev
```

Then open the URL shown in the terminal (usually http://localhost:5173).

## Where things are

* `src/data/mockData.js` — all dummy data (users, projects, findings). Edit this to change what shows up.
* `src/context/AuthContext.jsx` — fake login (any username/password works).
* `src/context/DataContext.jsx` — in-memory "database": creating a finding or project updates state here.
* `src/pages/admin/*` — everything the Admin/Reviewer sees.
* `src/pages/user/*` — everything the assigned Developer/User sees.
* `src/components/*` — small reusable pieces (badges, sidebar, topbar, avatar).
* `src/layouts/*` — the sidebar + page frame shared across admin or user pages.

## Login

On the login screen, type anything into the username/password fields (this is a demo — nothing is checked), then click "Enter as Admin" or "Enter as User".
