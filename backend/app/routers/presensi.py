from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from typing import Optional
import re
import json

from app.models.presensi import (
    PresensiBatchUpsertRequest,
    PresensiBatchUpsertResponse,
    PresensiFromChatRequest,
    PresensiFromChatResponse,
    RekapPresensiResponse,
    StatusPresensi
)
from app.utils.auth import get_current_user_profile
from app.utils.gemini import generate_response
from app.database import get_supabase_client

router = APIRouter(prefix="/api/presensi", tags=["presensi"])


@router.post("/batch", response_model=PresensiBatchUpsertResponse)
async def upsert_presensi_batch(
    payload: PresensiBatchUpsertRequest,
    profile: dict = Depends(get_current_user_profile)
):
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    user_id = profile["profile"]["id"]

    # Validate kelompok ownership
    kelompok_response = supabase.table("kelompok").select("id, ra_id").eq(
        "id", payload.kelompok_id
    ).limit(1).execute()

    if len(kelompok_response.data) == 0:
        raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")

    kelompok = kelompok_response.data[0]
    if kelompok["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke kelompok ini")

    # Validate siswa list in kelompok
    siswa_response = supabase.table("siswa").select("id").eq(
        "kelompok_id", payload.kelompok_id
    ).eq("status_aktif", True).execute()
    siswa_id_set = {row["id"] for row in siswa_response.data or []}

    if not siswa_id_set:
        raise HTTPException(status_code=400, detail="Kelompok belum memiliki siswa aktif")

    inserted = 0
    updated = 0

    for record in payload.records:
        if record.siswa_id not in siswa_id_set:
            continue

        existing_response = supabase.table("presensi").select("id").eq(
            "siswa_id", record.siswa_id
        ).eq("tanggal", str(payload.tanggal)).limit(1).execute()

        if len(existing_response.data) > 0:
            supabase.table("presensi").update({
                "status": record.status.value,
                "dicatat_oleh": user_id,
                "keterangan": record.keterangan,
                "sumber_pencatatan": record.sumber_pencatatan or "manual_panel",
            }).eq("id", existing_response.data[0]["id"]).execute()
            updated += 1
        else:
            supabase.table("presensi").insert({
                "siswa_id": record.siswa_id,
                "tanggal": str(payload.tanggal),
                "status": record.status.value,
                "dicatat_oleh": user_id,
                "keterangan": record.keterangan,
                "sumber_pencatatan": record.sumber_pencatatan or "manual_panel",
            }).execute()
            inserted += 1

    return PresensiBatchUpsertResponse(
        success=True,
        message="Presensi berhasil disimpan",
        inserted=inserted,
        updated=updated,
    )

@router.post("/from-chat", response_model=PresensiFromChatResponse)
async def presensi_from_chat(
    request: PresensiFromChatRequest,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Parse pesan kehadiran menggunakan AI dan simpan ke tabel presensi.
    Contoh pesan: 'Hari ini Kelompok A: Budi hadir, Ani sakit, Citra izin'
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    user_id = profile["profile"]["id"]
    
    # Gunakan Gemini untuk parsing pesan kehadiran
    prompt = f"""Kamu adalah asisten yang membantu guru mencatat kehadiran siswa.
Parsing pesan berikut dan ekstrak data kehadiran dalam format JSON.

Format output yang diharapkan (JSON array):
[
  {{"nama_siswa": "...", "status": "hadir/sakit/izin/alpha"}},
  ...
]

Jika tidak ada data kehadiran yang jelas, kembalikan array kosong: []

Pesan: {request.pesan}

Output (hanya JSON, tanpa markdown atau penjelasan):"""
    
    try:
        ai_response = generate_response(prompt).strip()
        
        # Bersihkan markdown code block jika ada
        ai_response = re.sub(r'^```json\s*', '', ai_response)
        ai_response = re.sub(r'\s*```$', '', ai_response)
        
        parsed_data = json.loads(ai_response)
        
        if not isinstance(parsed_data, list):
            raise ValueError("Response bukan array")
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Gagal parsing pesan kehadiran: {str(e)}"
        )
    
    if len(parsed_data) == 0:
        return PresensiFromChatResponse(
            success=True,
            message="Tidak ada data kehadiran yang terdeteksi",
            jumlah_dicatat=0,
            detail=[]
        )
    
    # Ambil tanggal hari ini
    today = date.today()
    
    # Proses setiap siswa dalam parsed data
    hasil_detail = []
    jumlah_dicatat = 0
    
    for item in parsed_data:
        nama_siswa = item.get("nama_siswa", "").strip()
        status_str = item.get("status", "").lower()
        
        if not nama_siswa or status_str not in ["hadir", "sakit", "izin", "alpha"]:
            hasil_detail.append({
                "nama": nama_siswa,
                "status": "error",
                "keterangan": "Format tidak valid"
            })
            continue
        
        # Cari siswa berdasarkan nama (case insensitive) yang aktif dan milik RA ini
        siswa_response = supabase.table("siswa").select(
            "id, nama, kelompok_id, kelompok:kelompok_id(nama_kelompok, ra_id)"
        ).ilike("nama", f"%{nama_siswa}%").eq("status_aktif", True).execute()
        
        # Filter siswa yang kelompoknya milik ra_id ini
        siswa_list = [
            s for s in siswa_response.data 
            if s.get("kelompok") and s["kelompok"].get("ra_id") == ra_id
        ]
        
        if len(siswa_list) == 0:
            hasil_detail.append({
                "nama": nama_siswa,
                "status": "error",
                "keterangan": "Siswa tidak ditemukan"
            })
            continue
        
        if len(siswa_list) > 1:
            hasil_detail.append({
                "nama": nama_siswa,
                "status": "warning",
                "keterangan": f"Ditemukan {len(siswa_list)} siswa dengan nama serupa, gunakan nama lengkap"
            })
            continue
        
        siswa = siswa_list[0]
        
        # Cek apakah sudah ada presensi hari ini untuk siswa ini
        existing_response = supabase.table("presensi").select("id").eq(
            "siswa_id", siswa["id"]
        ).eq("tanggal", str(today)).execute()
        
        if len(existing_response.data) > 0:
            # Update presensi yang sudah ada
            update_response = supabase.table("presensi").update({
                "status": status_str,
                "dicatat_oleh": user_id,
                "sumber_pencatatan": "chat"
            }).eq("id", existing_response.data[0]["id"]).execute()
            
            hasil_detail.append({
                "nama": siswa["nama"],
                "status": status_str,
                "keterangan": "Diperbarui"
            })
            jumlah_dicatat += 1
        else:
            # Insert presensi baru
            insert_response = supabase.table("presensi").insert({
                "siswa_id": siswa["id"],
                "tanggal": str(today),
                "status": status_str,
                "dicatat_oleh": user_id,
                "sumber_pencatatan": "chat"
            }).execute()
            
            hasil_detail.append({
                "nama": siswa["nama"],
                "status": status_str,
                "keterangan": "Berhasil dicatat"
            })
            jumlah_dicatat += 1
    
    return PresensiFromChatResponse(
        success=True,
        message=f"Berhasil mencatat {jumlah_dicatat} dari {len(parsed_data)} data",
        jumlah_dicatat=jumlah_dicatat,
        detail=hasil_detail
    )


@router.get("/rekap", response_model=RekapPresensiResponse)
async def get_rekap_presensi(
    tanggal: Optional[str] = None,
    kelompok_id: Optional[str] = None,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil rekap presensi harian per kelompok.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Default tanggal hari ini jika tidak ada
    target_date = date.fromisoformat(tanggal) if tanggal else date.today()
    
    # Validasi kelompok milik RA ini
    if kelompok_id:
        kelompok_response = supabase.table("kelompok").select("id, nama_kelompok, ra_id").eq(
            "id", kelompok_id
        ).execute()
        
        if len(kelompok_response.data) == 0:
            raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")
        
        kelompok = kelompok_response.data[0]
        if kelompok["ra_id"] != ra_id:
            raise HTTPException(status_code=403, detail="Tidak memiliki akses ke kelompok ini")
    else:
        raise HTTPException(status_code=400, detail="kelompok_id harus diisi")
    
    # Ambil semua siswa aktif di kelompok ini
    siswa_response = supabase.table("siswa").select("id, nama").eq(
        "kelompok_id", kelompok_id
    ).eq("status_aktif", True).execute()
    
    total_siswa = len(siswa_response.data)
    
    # Ambil semua presensi untuk tanggal dan kelompok ini
    presensi_response = supabase.table("presensi").select(
        "id, siswa_id, status, keterangan, sumber_pencatatan, siswa:siswa_id(nama)"
    ).eq("tanggal", str(target_date)).in_(
        "siswa_id", [s["id"] for s in siswa_response.data]
    ).execute()
    
    # Hitung per status
    count_hadir = sum(1 for p in presensi_response.data if p["status"] == "hadir")
    count_sakit = sum(1 for p in presensi_response.data if p["status"] == "sakit")
    count_izin = sum(1 for p in presensi_response.data if p["status"] == "izin")
    count_alpha = sum(1 for p in presensi_response.data if p["status"] == "alpha")
    count_belum = total_siswa - len(presensi_response.data)
    
    # Build detail
    detail = []
    presensi_map = {p["siswa_id"]: p for p in presensi_response.data}
    
    for siswa in siswa_response.data:
        if siswa["id"] in presensi_map:
            p = presensi_map[siswa["id"]]
            detail.append({
                "siswa_id": siswa["id"],
                "nama": siswa["nama"],
                "status": p["status"],
                "keterangan": p.get("keterangan"),
                "sumber_pencatatan": p.get("sumber_pencatatan"),
            })
        else:
            detail.append({
                "siswa_id": siswa["id"],
                "nama": siswa["nama"],
                "status": "belum_dicatat",
                "keterangan": None,
                "sumber_pencatatan": None,
            })
    
    return RekapPresensiResponse(
        tanggal=target_date,
        kelompok_id=kelompok_id,
        kelompok_nama=kelompok["nama_kelompok"],
        total_siswa=total_siswa,
        hadir=count_hadir,
        sakit=count_sakit,
        izin=count_izin,
        alpha=count_alpha,
        belum_dicatat=count_belum,
        detail=detail
    )
