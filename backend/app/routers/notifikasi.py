from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.models.notifikasi import NotifikasiResponse
from app.utils.auth import get_current_user_profile
from app.database import get_supabase_client

router = APIRouter(prefix="/api/notifikasi", tags=["notifikasi"])

@router.get("/", response_model=List[NotifikasiResponse])
async def get_notifikasi_list(
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil daftar notifikasi untuk user, urut terbaru.
    """
    supabase = get_supabase_client()
    user_id = profile["profile"]["id"]
    
    response = supabase.table("notifikasi").select(
        "id, user_id, judul, pesan, dibaca, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).execute()
    
    return response.data


@router.put("/{id}/baca", response_model=NotifikasiResponse)
async def mark_notifikasi_dibaca(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Tandai notifikasi sebagai sudah dibaca.
    """
    supabase = get_supabase_client()
    user_id = profile["profile"]["id"]
    
    # Cek kepemilikan notifikasi
    existing_response = supabase.table("notifikasi").select("id, user_id").eq(
        "id", id
    ).execute()
    
    if len(existing_response.data) == 0:
        raise HTTPException(status_code=404, detail="Notifikasi tidak ditemukan")
    
    notif = existing_response.data[0]
    if notif["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke notifikasi ini")
    
    # Update status dibaca
    update_response = supabase.table("notifikasi").update({
        "dibaca": True
    }).eq("id", id).execute()
    
    if len(update_response.data) == 0:
        raise HTTPException(status_code=500, detail="Gagal update notifikasi")
    
    return update_response.data[0]
