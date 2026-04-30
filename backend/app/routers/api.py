from fastapi import APIRouter
from app.routers.presensi_gtk import router as presensi_gtk_router

router = APIRouter()
router.include_router(presensi_gtk_router, prefix="/presensi-gtk")
