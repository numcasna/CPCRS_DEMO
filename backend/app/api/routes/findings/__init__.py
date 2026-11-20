from fastapi import APIRouter

from app.api.routes.findings.activity import router as activity_router
from app.api.routes.findings.attachments import router as attachments_router
from app.api.routes.findings.core import router as core_router
from app.api.routes.findings.status import router as status_router

router = APIRouter(tags=["Findings"])
router.include_router(core_router, prefix="/findings")
router.include_router(status_router, prefix="/findings")
router.include_router(activity_router, prefix="/findings")
router.include_router(attachments_router, prefix="/findings")
