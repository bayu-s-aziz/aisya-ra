import re
from datetime import date

from fastapi import HTTPException, status

MANAGE_ACADEMIC_YEAR_ROLES = {"kepala_ra", "kepala", "admin", "admin_ra"}


def is_academic_year_manager(role: str | None) -> bool:
    return (role or "").lower() in MANAGE_ACADEMIC_YEAR_ROLES


def _default_academic_year_label() -> str:
    today = date.today()
    start_year = today.year if today.month >= 7 else today.year - 1
    return f"{start_year}/{start_year + 1}"


def normalize_academic_year_label(raw_label: str | None) -> str:
    label = (raw_label or "").strip()
    if not label:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Label tahun ajaran wajib diisi",
        )

    match = re.match(r"^(\d{4})\s*[-/]\s*(\d{4})$", label)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format tahun ajaran harus YYYY/YYYY, contoh 2026/2027",
        )

    start_year = int(match.group(1))
    end_year = int(match.group(2))

    if end_year != start_year + 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format tahun ajaran tidak valid. Tahun akhir harus tahun awal + 1",
        )

    return f"{start_year}/{end_year}"


def _read_ra_profile_tahun_ajaran(supabase, ra_id: str) -> str | None:
    try:
        response = (
            supabase.table("sekolah")
            .select("tahun_ajaran")
            .eq("id", ra_id)
            .limit(1)
            .execute()
        )
    except Exception:
        return None

    if not response.data:
        return None

    return response.data[0].get("tahun_ajaran")


def _sync_ra_profile_tahun_ajaran(supabase, ra_id: str, label: str):
    try:
        (
            supabase.table("sekolah")
            .update({"tahun_ajaran": label})
            .eq("id", ra_id)
            .execute()
        )
    except Exception:
        # Keep API resilient even if syncing label to ra_profiles fails.
        pass


def _activate_existing_year(supabase, ra_id: str, tahun_ajaran_id: str):
    (
        supabase.table("tahun_ajaran")
        .update({"is_active": False})
        .eq("ra_id", ra_id)
        .execute()
    )

    response = (
        supabase.table("tahun_ajaran")
        .update({"is_active": True})
        .eq("id", tahun_ajaran_id)
        .eq("ra_id", ra_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data tahun ajaran tidak ditemukan",
        )

    activated = response.data[0]
    _sync_ra_profile_tahun_ajaran(supabase, ra_id, activated.get("label") or "")
    return activated


def get_active_academic_year(supabase, ra_id: str, created_by: str | None = None):
    try:
        active_response = (
            supabase.table("tahun_ajaran")
            .select("id,ra_id,label,is_active,hari_efektif_belajar,created_at,updated_at")
            .eq("ra_id", ra_id)
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membaca tahun ajaran aktif: {exc}",
        ) from exc

    if active_response.data:
        active = active_response.data[0]
        _sync_ra_profile_tahun_ajaran(supabase, ra_id, active.get("label") or "")
        return active

    try:
        latest_response = (
            supabase.table("tahun_ajaran")
            .select("id,ra_id,label,is_active,hari_efektif_belajar,created_at,updated_at")
            .eq("ra_id", ra_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membaca daftar tahun ajaran: {exc}",
        ) from exc

    if latest_response.data:
        latest = latest_response.data[0]
        return _activate_existing_year(supabase, ra_id, latest["id"])

    profile_year = _read_ra_profile_tahun_ajaran(supabase, ra_id)
    if profile_year:
        try:
            normalized_label = normalize_academic_year_label(profile_year)
        except HTTPException:
            normalized_label = _default_academic_year_label()
    else:
        normalized_label = _default_academic_year_label()

    insert_payload = {
        "ra_id": ra_id,
        "label": normalized_label,
        "is_active": True,
        "hari_efektif_belajar": 5,
    }
    if created_by:
        insert_payload["created_by"] = created_by

    try:
        created_response = (
            supabase.table("tahun_ajaran")
            .insert(insert_payload)
            .execute()
        )
        created = created_response.data[0] if created_response.data else None
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membuat tahun ajaran awal: {exc}",
        ) from exc

    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal menyiapkan tahun ajaran aktif",
        )

    _sync_ra_profile_tahun_ajaran(supabase, ra_id, created.get("label") or normalized_label)
    return created


def get_active_academic_year_id(supabase, ra_id: str, created_by: str | None = None) -> str:
    active = get_active_academic_year(supabase, ra_id, created_by=created_by)
    tahun_ajaran_id = active.get("id")
    if not tahun_ajaran_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tahun ajaran aktif tidak valid",
        )
    return tahun_ajaran_id


def activate_academic_year(supabase, ra_id: str, tahun_ajaran_id: str):
    return _activate_existing_year(supabase, ra_id, tahun_ajaran_id)
