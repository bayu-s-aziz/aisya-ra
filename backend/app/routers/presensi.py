from fastapi import APIRouter, Depends, HTTPException
from datetime import date, timedelta
from typing import Optional
import re
import json
from calendar import monthrange

from app.models.presensi import (
    ModeRekapPresensi,
    PresensiBatchUpsertRequest,
    PresensiBatchUpsertResponse,
    PresensiFromChatRequest,
    PresensiFromChatResponse,
    RekapPresensiPeriodeResponse,
    RekapPresensiPeriodeSummary,
    RekapPresensiResponse,
    StatusPresensi
)
from app.utils.academic_calendar import (
    fetch_holiday_dates,
    filter_learning_dates,
    normalize_effective_school_days,
)
from app.utils.academic_year import get_active_academic_year
from app.utils.auth import get_current_user_profile
from app.utils.gemini import generate_response
from app.database import get_supabase_client

router = APIRouter(prefix="/api/presensi", tags=["presensi"])


def _get_period_range(mode: ModeRekapPresensi, target_date: date) -> tuple[date, date]:
    if mode == ModeRekapPresensi.harian:
        return target_date, target_date

    if mode == ModeRekapPresensi.mingguan:
        start_date = target_date - timedelta(days=target_date.weekday())
        end_date = start_date + timedelta(days=6)
        return start_date, end_date

    start_date = date(target_date.year, target_date.month, 1)
    end_date = date(target_date.year, target_date.month, monthrange(target_date.year, target_date.month)[1])
    return start_date, end_date


def _iterate_dates(start_date: date, end_date: date) -> list[date]:
    total_days = (end_date - start_date).days + 1
    return [start_date + timedelta(days=offset) for offset in range(total_days)]


@router.post("/batch", response_model=PresensiBatchUpsertResponse)
async def upsert_presensi_batch(
    payload: PresensiBatchUpsertRequest,
    profile: dict = Depends(get_current_user_profile)
):
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    user_id = profile["profile"]["id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]

    # Validate kelompok ownership
    kelompok_response = supabase.table("kelompok_belajar").select("id, ra_id").eq(
        "id", payload.kelompok_id
    ).eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).limit(1).execute()
    kelompok_rows = kelompok_response.data or []

    if len(kelompok_rows) == 0:
        raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")

    # Validate siswa list in kelompok
    siswa_response = supabase.table("siswa").select("id").eq(
        "kelompok_id", payload.kelompok_id
    ).eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).eq("status_aktif", True).execute()
    siswa_rows = siswa_response.data or []
    siswa_ids = [row["id"] for row in siswa_rows]
    siswa_id_set = set(siswa_ids)

    if not siswa_id_set:
        raise HTTPException(status_code=400, detail="Kelompok belum memiliki siswa aktif")

    # Siapkan data request per siswa (hanya siswa valid di kelompok)
    requested_map = {}
    for record in payload.records:
        if record.siswa_id in siswa_id_set:
            requested_map[record.siswa_id] = record

    # Ambil presensi existing sekali untuk semua siswa pada tanggal yang sama
    existing_response = supabase.table("presensi").select(
        "id, siswa_id, status, keterangan, sumber_pencatatan"
    ).eq("tanggal", str(payload.tanggal)).eq("tahun_ajaran_id", tahun_ajaran_id).in_(
        "siswa_id", siswa_ids
    ).execute()
    existing_rows = existing_response.data or []
    existing_map = {row["siswa_id"]: row for row in existing_rows}

    # Pola sederhana manajemen presensi:
    # - Jika ada status dari panel: pakai status panel
    # - Jika belum dikirim tapi sudah pernah dicatat: pertahankan status existing
    # - Jika belum ada catatan sama sekali: default "hadir"
    upsert_rows = []
    inserted = 0
    updated = 0

    for siswa_id in siswa_ids:
        requested = requested_map.get(siswa_id)
        existing = existing_map.get(siswa_id)

        if requested:
            status_value = requested.status.value
            keterangan_value = requested.keterangan
            sumber_value = requested.sumber_pencatatan or "manual_panel"
            if existing:
                updated += 1
            else:
                inserted += 1
        elif existing:
            # Pertahankan data existing jika tidak ada request baru
            status_value = existing["status"]
            keterangan_value = existing.get("keterangan")
            sumber_value = existing.get("sumber_pencatatan") or "manual_panel"
        else:
            # Jangan buat record baru jika tidak ada data request dan belum ada data existing
            continue

        upsert_rows.append({
            "siswa_id": siswa_id,
            "tanggal": str(payload.tanggal),
            "status": status_value,
            "dicatat_oleh": user_id,
            "keterangan": keterangan_value,
            "sumber_pencatatan": sumber_value,
            "tahun_ajaran_id": tahun_ajaran_id,
        })

    if upsert_rows:
        supabase.table("presensi").upsert(
            upsert_rows,
            on_conflict="siswa_id,tanggal"
        ).execute()

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
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]
    
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
            "id, nama, kelompok_id"
        ).ilike("nama", f"%{nama_siswa}%").eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).eq("status_aktif", True).execute()
        siswa_list = siswa_response.data or []
        
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
        ).eq("tanggal", str(today)).eq("tahun_ajaran_id", tahun_ajaran_id).execute()
        existing_rows = existing_response.data or []
        
        if len(existing_rows) > 0:
            # Update presensi yang sudah ada
            update_response = supabase.table("presensi").update({
                "status": status_str,
                "dicatat_oleh": user_id,
                "sumber_pencatatan": "chat",
                "tahun_ajaran_id": tahun_ajaran_id,
            }).eq("id", existing_rows[0]["id"]).execute()
            
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
                "sumber_pencatatan": "chat",
                "tahun_ajaran_id": tahun_ajaran_id,
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
    user_id = profile["profile"]["id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]
    
    # Default tanggal hari ini jika tidak ada
    target_date = date.fromisoformat(tanggal) if tanggal else date.today()
    
    # Validasi kelompok milik RA ini
    if kelompok_id:
        kelompok_response = supabase.table("kelompok_belajar").select("id, nama_kelompok, ra_id").eq(
            "id", kelompok_id
        ).eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).execute()
        kelompok_rows = kelompok_response.data or []
        
        if len(kelompok_rows) == 0:
            raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")
        
        kelompok = kelompok_rows[0]
    else:
        raise HTTPException(status_code=400, detail="kelompok_id harus diisi")
    
    # Ambil semua siswa aktif di kelompok ini
    siswa_response = supabase.table("siswa").select("id, nama").eq(
        "kelompok_id", kelompok_id
    ).eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).eq("status_aktif", True).execute()
    siswa_data = siswa_response.data or []
    total_siswa = len(siswa_data)
    
    # Ambil semua presensi untuk tanggal dan kelompok ini
    siswa_ids = [s["id"] for s in siswa_data]

    if siswa_ids:
        presensi_response = supabase.table("presensi").select(
            "id, siswa_id, status, keterangan, sumber_pencatatan, siswa:siswa_id(nama)"
        ).eq("tanggal", str(target_date)).eq("tahun_ajaran_id", tahun_ajaran_id).in_(
            "siswa_id", siswa_ids
        ).execute()
        presensi_data = presensi_response.data or []
    else:
        presensi_data = []
    
    # Hitung per status
    count_hadir = sum(1 for p in presensi_data if p["status"] == "hadir")
    count_sakit = sum(1 for p in presensi_data if p["status"] == "sakit")
    count_izin = sum(1 for p in presensi_data if p["status"] == "izin")
    count_alpha = sum(1 for p in presensi_data if p["status"] == "alpha")
    count_belum = total_siswa - len(presensi_data)
    
    # Build detail
    detail = []
    presensi_map = {p["siswa_id"]: p for p in presensi_data}
    
    for siswa in siswa_data:
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


@router.get("/rekap-periode", response_model=RekapPresensiPeriodeResponse)
async def get_rekap_presensi_periode(
    mode: ModeRekapPresensi = ModeRekapPresensi.harian,
    tanggal: Optional[str] = None,
    kelompok_id: Optional[str] = None,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil rekap presensi berdasarkan periode harian, mingguan, atau bulanan.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    user_id = profile["profile"]["id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]

    target_date = date.fromisoformat(tanggal) if tanggal else date.today()

    if kelompok_id:
        kelompok_response = supabase.table("kelompok_belajar").select("id, nama_kelompok, ra_id").eq(
            "id", kelompok_id
        ).eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).limit(1).execute()
        kelompok_rows = kelompok_response.data or []
        if len(kelompok_rows) == 0:
            raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")
        kelompok = kelompok_rows[0]
    else:
        raise HTTPException(status_code=400, detail="kelompok_id harus diisi")

    siswa_response = supabase.table("siswa").select("id, nama").eq(
        "kelompok_id", kelompok_id
    ).eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).eq("status_aktif", True).execute()
    siswa_rows = siswa_response.data or []
    siswa_ids = [row["id"] for row in siswa_rows]
    total_siswa = len(siswa_ids)

    start_date, end_date = _get_period_range(mode, target_date)
    source_dates = _iterate_dates(start_date, end_date)
    hari_efektif = normalize_effective_school_days(active_year.get("hari_efektif_belajar", 5))
    holiday_dates = fetch_holiday_dates(
        supabase,
        ra_id,
        tahun_ajaran_id,
        start_date=start_date,
        end_date=end_date,
    )
    date_list = filter_learning_dates(source_dates, hari_efektif, holiday_dates)

    if not date_list:
        return RekapPresensiPeriodeResponse(
            mode=mode,
            kelompok_id=kelompok_id,
            kelompok_nama=kelompok["nama_kelompok"],
            tanggal_acuan=target_date,
            tanggal_mulai=start_date,
            tanggal_selesai=end_date,
            total_siswa=total_siswa,
            summary=RekapPresensiPeriodeSummary(
                total_hari=0,
                total_slot_presensi=0,
                hadir=0,
                sakit=0,
                izin=0,
                alpha=0,
                belum_dicatat=0,
                persentase_hadir=0.0,
            ),
            detail_harian=[],
            detail_siswa=[
                {
                    "siswa_id": row["id"],
                    "nama": row.get("nama") or "-",
                    "hadir": 0,
                    "sakit": 0,
                    "izin": 0,
                    "alpha": 0,
                    "belum_dicatat": 0,
                    "persentase_hadir": 0.0,
                    "status_per_tanggal": [],
                }
                for row in sorted(siswa_rows, key=lambda row: (row.get("nama") or "").lower())
            ],
        )

    date_strings = [str(d) for d in date_list]

    daily_counts = {
        ds: {
            "hadir": 0,
            "sakit": 0,
            "izin": 0,
            "alpha": 0,
            "belum_dicatat": total_siswa,
        }
        for ds in date_strings
    }
    student_period_counts = {
        row["id"]: {
            "siswa_id": row["id"],
            "nama": row.get("nama") or "-",
            "hadir": 0,
            "sakit": 0,
            "izin": 0,
            "alpha": 0,
            "status_per_tanggal": {ds: "belum_dicatat" for ds in date_strings},
        }
        for row in siswa_rows
    }

    if siswa_ids and date_strings:
        presensi_response = supabase.table("presensi").select(
            "siswa_id, tanggal, status"
        ).eq("tahun_ajaran_id", tahun_ajaran_id).in_("siswa_id", siswa_ids).gte(
            "tanggal", str(start_date)
        ).lte("tanggal", str(end_date)).execute()
        presensi_rows = presensi_response.data or []

        for row in presensi_rows:
            siswa_id = row.get("siswa_id")
            day_key = row.get("tanggal")
            status = row.get("status")
            if day_key not in daily_counts:
                continue
            if siswa_id not in student_period_counts:
                continue
            if status not in ["hadir", "sakit", "izin", "alpha"]:
                continue

            daily_counts[day_key][status] += 1
            student_period_counts[siswa_id][status] += 1
            student_period_counts[siswa_id]["status_per_tanggal"][day_key] = status

        for day_key in date_strings:
            recorded_count = (
                daily_counts[day_key]["hadir"]
                + daily_counts[day_key]["sakit"]
                + daily_counts[day_key]["izin"]
                + daily_counts[day_key]["alpha"]
            )
            daily_counts[day_key]["belum_dicatat"] = max(0, total_siswa - recorded_count)

    detail_harian = []
    total_hadir = 0
    total_sakit = 0
    total_izin = 0
    total_alpha = 0
    total_belum = 0

    for d in date_list:
        day_key = str(d)
        counts = daily_counts[day_key]
        total_hadir += counts["hadir"]
        total_sakit += counts["sakit"]
        total_izin += counts["izin"]
        total_alpha += counts["alpha"]
        total_belum += counts["belum_dicatat"]
        detail_harian.append({
            "tanggal": d,
            "hadir": counts["hadir"],
            "sakit": counts["sakit"],
            "izin": counts["izin"],
            "alpha": counts["alpha"],
            "belum_dicatat": counts["belum_dicatat"],
        })

    total_hari = len(date_list)
    total_slot = total_siswa * total_hari
    persentase_hadir = round((total_hadir / total_slot * 100), 2) if total_slot > 0 else 0.0

    detail_siswa = []
    sorted_siswa = sorted(siswa_rows, key=lambda row: (row.get("nama") or "").lower())
    for siswa in sorted_siswa:
        siswa_id = siswa["id"]
        item = student_period_counts[siswa_id]
        recorded_count = item["hadir"] + item["sakit"] + item["izin"] + item["alpha"]
        belum_count = max(0, total_hari - recorded_count)
        persentase_hadir_siswa = round((item["hadir"] / total_hari * 100), 2) if total_hari > 0 else 0.0

        detail_siswa.append({
            "siswa_id": siswa_id,
            "nama": item["nama"],
            "hadir": item["hadir"],
            "sakit": item["sakit"],
            "izin": item["izin"],
            "alpha": item["alpha"],
            "belum_dicatat": belum_count,
            "persentase_hadir": persentase_hadir_siswa,
            "status_per_tanggal": [
                {
                    "tanggal": d,
                    "status": item["status_per_tanggal"][str(d)],
                }
                for d in date_list
            ],
        })

    return RekapPresensiPeriodeResponse(
        mode=mode,
        kelompok_id=kelompok_id,
        kelompok_nama=kelompok["nama_kelompok"],
        tanggal_acuan=target_date,
        tanggal_mulai=start_date,
        tanggal_selesai=end_date,
        total_siswa=total_siswa,
        summary=RekapPresensiPeriodeSummary(
            total_hari=total_hari,
            total_slot_presensi=total_slot,
            hadir=total_hadir,
            sakit=total_sakit,
            izin=total_izin,
            alpha=total_alpha,
            belum_dicatat=total_belum,
            persentase_hadir=persentase_hadir,
        ),
        detail_harian=detail_harian,
        detail_siswa=detail_siswa,
    )
