from fastapi import APIRouter, Depends, HTTPException
from datetime import date, datetime
from typing import Optional

from app.models.presensi_gtk import (
    PresensiGTKCreate,
    PresensiGTKResponse,
    RekapPresensiGTKResponse
)
from app.models.presensi import StatusPresensi
from app.utils.academic_year import get_active_academic_year
from app.utils.auth import get_current_user_profile
from app.database import get_supabase_client

router = APIRouter(prefix="", tags=["presensi-gtk"])

@router.post("/record", response_model=PresensiGTKResponse)
async def record_gtk_presence(
    payload: PresensiGTKCreate,
    profile: dict = Depends(get_current_user_profile)
):
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    user_id = profile["profile"]["id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]

    # Check if recording for self or if admin
    if payload.pengguna_id != user_id and profile["profile"]["role"] not in ["kepala_ra", "admin", "admin_ra"]:
        raise HTTPException(status_code=403, detail="Hanya admin/kepala yang bisa mencatat kehadiran GTK lain")

    # Upsert attendance
    attendance_data = {
        "pengguna_id": payload.pengguna_id,
        "tanggal": str(payload.tanggal),
        "status": payload.status.value,
        "dicatat_oleh": user_id,
        "keterangan": payload.keterangan,
        "sumber_pencatatan": payload.sumber_pencatatan,
        "tahun_ajaran_id": tahun_ajaran_id,
    }

    response = supabase.table("presensi_gtk").upsert(
        attendance_data,
        on_conflict="pengguna_id,tanggal"
    ).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Gagal mencatat kehadiran")

    return response.data[0]

@router.get("/me", response_model=list[PresensiGTKResponse])
async def get_my_presence_history(
    profile: dict = Depends(get_current_user_profile)
):
    supabase = get_supabase_client()
    user_id = profile["profile"]["id"]
    
    response = supabase.table("presensi_gtk").select("*").eq("pengguna_id", user_id).order("tanggal", desc=True).limit(30).execute()
    return response.data or []

@router.get("/rekap", response_model=RekapPresensiGTKResponse)
async def get_rekap_presensi_gtk(
    tanggal: Optional[str] = None,
    profile: dict = Depends(get_current_user_profile)
):
    if profile["profile"]["role"] not in ["kepala_ra", "admin", "admin_ra"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")

    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    user_id = profile["profile"]["id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]
    
    target_date = date.fromisoformat(tanggal) if tanggal else date.today()

    # Get all GTK in this RA
    gtk_response = supabase.table("pengguna").select("id, nama, email, role, jabatan").eq("ra_id", ra_id).execute()
    gtk_list = gtk_response.data or []
    total_gtk = len(gtk_list)
    gtk_ids = [g["id"] for g in gtk_list]

    # Get attendance for target date
    presence_response = supabase.table("presensi_gtk").select("*").eq("tanggal", str(target_date)).in_("pengguna_id", gtk_ids).execute()
    presence_data = presence_response.data or []
    presence_map = {p["pengguna_id"]: p for p in presence_data}

    detail = []
    counts = {"hadir": 0, "sakit": 0, "izin": 0, "alpha": 0, "belum_dicatat": 0}

    for gtk in gtk_list:
        presence = presence_map.get(gtk["id"])
        if presence:
            status = presence["status"]
            counts[status] += 1
            detail.append({
                "pengguna_id": gtk["id"],
                "nama": gtk["nama"],
                "role": gtk["role"],
                "jabatan": gtk["jabatan"],
                "status": status,
                "keterangan": presence.get("keterangan"),
                "sumber_pencatatan": presence.get("sumber_pencatatan"),
            })
        else:
            counts["belum_dicatat"] += 1
            detail.append({
                "pengguna_id": gtk["id"],
                "nama": gtk["nama"],
                "role": gtk["role"],
                "jabatan": gtk["jabatan"],
                "status": "belum_dicatat",
                "keterangan": None,
                "sumber_pencatatan": None,
            })

    return RekapPresensiGTKResponse(
        tanggal=target_date,
        total_gtk=total_gtk,
        hadir=counts["hadir"],
        sakit=counts["sakit"],
        izin=counts["izin"],
        alpha=counts["alpha"],
        belum_dicatat=counts["belum_dicatat"],
        detail=detail
    )
