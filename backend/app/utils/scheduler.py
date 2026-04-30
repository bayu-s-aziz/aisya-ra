from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date
from app.database import get_supabase_client
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def check_presensi_reminder():
    """
    Job yang dijalankan setiap pagi jam 06:00 untuk mengecek guru yang belum mengisi presensi.
    """
    try:
        supabase = get_supabase_client()
        today = date.today()
        
        logger.info(f"Running presensi reminder check for {today}")
        
        # Ambil semua kelompok yang aktif
        kelompok_response = supabase.table("kelompok_belajar").select(
            "id, nama_kelompok, ra_id"
        ).execute()
        
        notifications_created = 0
        
        for kelompok in kelompok_response.data:
            # Ambil siswa aktif di kelompok ini
            siswa_response = supabase.table("siswa").select("id").eq(
                "kelompok_id", kelompok["id"]
            ).eq("status_aktif", True).execute()
            
            if len(siswa_response.data) == 0:
                continue  # Skip kelompok tanpa siswa aktif
            
            siswa_ids = [s["id"] for s in siswa_response.data]
            
            # Cek apakah ada presensi hari ini untuk kelompok ini
            presensi_response = supabase.table("presensi").select("id").eq(
                "tanggal", str(today)
            ).in_("siswa_id", siswa_ids).execute()
            
            if len(presensi_response.data) == 0:
                # Belum ada presensi untuk kelompok ini, ambil guru yang mengajar
                # Untuk sekarang, kita anggap semua user di RA ini adalah guru
                # Bisa diperbaiki dengan menambah tabel guru_kelompok atau role management
                
                # Ambil semua user di RA ini (melalui pengguna)
                pengguna_response = supabase.table("pengguna").select(
                    "id"
                ).eq("ra_id", kelompok["ra_id"]).execute()
                
                for p in pengguna_response.data:
                    user_id = p["id"]
                    
                    # Buat notifikasi
                    notif_response = supabase.table("notifikasi").insert({
                        "user_id": user_id,
                        "judul": "Reminder: Isi Presensi",
                        "pesan": f"Presensi untuk {kelompok['nama_kelompok']} hari ini ({today}) belum diisi. Mohon segera dicatat.",
                        "dibaca": False
                    }).execute()
                    
                    if len(notif_response.data) > 0:
                        notifications_created += 1
        
        logger.info(f"Presensi reminder: created {notifications_created} notifications")
        
    except Exception as e:
        logger.error(f"Error in presensi reminder job: {str(e)}")


def start_scheduler():
    """
    Inisialisasi dan start scheduler.
    Job akan berjalan setiap hari jam 08:00.
    """
    # Tambahkan job dengan CronTrigger (jam 08:00 setiap hari)
    scheduler.add_job(
        check_presensi_reminder,
        CronTrigger(hour=8, minute=0),
        id="presensi_reminder",
        name="Check presensi and send reminders",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started: presensi reminder job scheduled at 08:00 daily")


def shutdown_scheduler():
    """
    Shutdown scheduler dengan graceful.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
