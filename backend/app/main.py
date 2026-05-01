from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers.api import router as api_router
from app.routers.auth import router as auth_router
from app.routers.kelompok import router as kelompok_router
from app.routers.siswa import router as siswa_router
from app.routers.chat import router as chat_router
from app.routers.rpph import router as rpph_router
from app.routers.presensi import router as presensi_router
from app.routers.notifikasi import router as notifikasi_router
from app.routers.knowledge import router as knowledge_router
from app.routers.template_surat import router as template_surat_router
from app.routers.surat import router as surat_router
from app.routers.dashboard import router as dashboard_router
from app.routers.tahun_ajaran import router as tahun_ajaran_router
from app.routers.presensi_gtk import router as presensi_gtk_router
from app.utils.scheduler import start_scheduler, shutdown_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start scheduler
    start_scheduler()
    yield
    # Shutdown: Stop scheduler
    shutdown_scheduler()

app = FastAPI(title="AISYA Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:80",
        "http://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(kelompok_router, prefix="/api/kelompok", tags=["kelompok"])
app.include_router(siswa_router, prefix="/api/siswa", tags=["siswa"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(rpph_router, prefix="/api/rpph", tags=["rpph"])
app.include_router(presensi_router)
app.include_router(notifikasi_router)
app.include_router(knowledge_router)
app.include_router(template_surat_router)
app.include_router(surat_router)
app.include_router(dashboard_router)
app.include_router(tahun_ajaran_router, prefix="/api/tahun-ajaran", tags=["tahun_ajaran"])
app.include_router(presensi_gtk_router, prefix="/api/presensi-gtk", tags=["presensi-gtk"])

@app.get("/")
def root():
    return {"message": "AISYA Backend is running"}

