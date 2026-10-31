
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.routes.auth import router as auth_router
from app.api.routes.findings import router as findings_router
from app.database import get_db
from app.api.routes.projects import router as projects_router
from app.api.routes.repositories import router as repositories_router
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.users import router as users_router

app = FastAPI(
    title="Cross-Project Code Review Finding Tracker",
    description="Backend API for projects, repositories and code-review findings.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(findings_router)
app.include_router(repositories_router)
app.include_router(users_router)

@app.get("/")
def root():
    return {
        "message": "Cross-Project Code Review Finding Tracker API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        ) from exc
