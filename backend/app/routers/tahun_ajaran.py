from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase_client
from app.models.tahun_ajaran import (
    KalenderPendidikanCreateRequest,
    KalenderPendidikanDeleteResponse,
    KalenderPendidikanListResponse,
    KalenderPendidikanSyncRequest,
    TahunAjaranCreateRequest,
    TahunAjaranConfigUpdateRequest,
    TahunAjaranDetailResponse,
    TahunAjaranListResponse,
)
from app.utils.academic_calendar import (
    fetch_calendar_events,
    normalize_effective_school_days,
    parse_date,
    sync_kemenag_calendar,
)
from app.utils.academic_year import (
    activate_academic_year,
    get_active_academic_year,
    is_academic_year_manager,
    normalize_academic_year_label,
)
from app.utils.auth import get_current_user_profile

router = APIRouter()


def _ensure_manage_permission(current: dict):
    role = (current["profile"].get("role") or "").lower()
    if not is_academic_year_manager(role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Kepala RA / Admin yang dapat mengelola tahun ajaran",
        )


def _find_tahun_ajaran(supabase, ra_id: str, tahun_ajaran_id: str):
    response = (
        supabase.table("tahun_ajaran")
        .select("id,ra_id,label,is_active,hari_efektif_belajar,created_at,updated_at")
        .eq("id", tahun_ajaran_id)
        .eq("ra_id", ra_id)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


@router.get("", response_model=TahunAjaranListResponse)
def list_tahun_ajaran(current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    get_active_academic_year(supabase, ra_id, created_by=user_id)

    try:
        response = (
            supabase.table("tahun_ajaran")
            .select("id,ra_id,label,is_active,hari_efektif_belajar,created_at,updated_at")
            .eq("ra_id", ra_id)
            .order("label", desc=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar tahun ajaran: {exc}",
        ) from exc

    data = response.data or []
    active_row = next((item for item in data if item.get("is_active")), None)

    return {
        "success": True,
        "data": data,
        "active_id": active_row.get("id") if active_row else None,
    }


@router.post("", response_model=TahunAjaranDetailResponse, status_code=status.HTTP_201_CREATED)
def create_tahun_ajaran(
    payload: TahunAjaranCreateRequest,
    current=Depends(get_current_user_profile),
):
    _ensure_manage_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]
    normalized_label = normalize_academic_year_label(payload.label)

    try:
        existing = (
            supabase.table("tahun_ajaran")
            .select("id")
            .eq("ra_id", ra_id)
            .eq("label", normalized_label)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memeriksa duplikasi tahun ajaran: {exc}",
        ) from exc

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tahun ajaran sudah ada",
        )

    try:
        response = (
            supabase.table("tahun_ajaran")
            .insert(
                {
                    "ra_id": ra_id,
                    "label": normalized_label,
                    "is_active": False,
                    "hari_efektif_belajar": 5,
                    "created_by": user_id,
                }
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menambah tahun ajaran: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Tahun ajaran berhasil ditambahkan",
        "data": response.data[0],
    }


@router.patch("/{tahun_ajaran_id}/activate", response_model=TahunAjaranDetailResponse)
def set_active_tahun_ajaran(
    tahun_ajaran_id: str,
    current=Depends(get_current_user_profile),
):
    _ensure_manage_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    target = _find_tahun_ajaran(supabase, ra_id, tahun_ajaran_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    try:
        activated = activate_academic_year(supabase, ra_id, tahun_ajaran_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengaktifkan tahun ajaran: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Tahun ajaran aktif berhasil diperbarui",
        "data": activated,
    }


@router.delete("/{tahun_ajaran_id}")
def delete_tahun_ajaran(
    tahun_ajaran_id: str,
    current=Depends(get_current_user_profile),
):
    _ensure_manage_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    target = _find_tahun_ajaran(supabase, ra_id, tahun_ajaran_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    usage_checks = [
        ("kelompok_belajar", "kelompok"),
        ("siswa", "siswa"),
        ("presensi", "presensi"),
        ("rpph", "RPPH"),
    ]

    for table_name, label in usage_checks:
        try:
            check = (
                supabase.table(table_name)
                .select("id")
                .eq("tahun_ajaran_id", tahun_ajaran_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gagal memeriksa relasi data {label}: {exc}",
            ) from exc

        if check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tahun ajaran tidak bisa dihapus karena masih dipakai data {label}",
            )

    if target.get("is_active"):
        try:
            another_response = (
                supabase.table("tahun_ajaran")
                .select("id")
                .eq("ra_id", ra_id)
                .neq("id", tahun_ajaran_id)
                .order("label", desc=True)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gagal menyiapkan tahun ajaran pengganti: {exc}",
            ) from exc

        if not another_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak bisa menghapus satu-satunya tahun ajaran aktif",
            )

        activate_academic_year(supabase, ra_id, another_response.data[0]["id"])

    try:
        delete_response = (
            supabase.table("tahun_ajaran")
            .delete()
            .eq("id", tahun_ajaran_id)
            .eq("ra_id", ra_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus tahun ajaran: {exc}",
        ) from exc

    if not delete_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    return {
        "success": True,
        "message": "Tahun ajaran berhasil dihapus",
        "data": {"id": tahun_ajaran_id},
    }


@router.patch("/{tahun_ajaran_id}/config", response_model=TahunAjaranDetailResponse)
def update_tahun_ajaran_config(
    tahun_ajaran_id: str,
    payload: TahunAjaranConfigUpdateRequest,
    current=Depends(get_current_user_profile),
):
    _ensure_manage_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    target = _find_tahun_ajaran(supabase, ra_id, tahun_ajaran_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    hari_efektif = normalize_effective_school_days(payload.hari_efektif_belajar)

    try:
        response = (
            supabase.table("tahun_ajaran")
            .update({"hari_efektif_belajar": hari_efektif})
            .eq("id", tahun_ajaran_id)
            .eq("ra_id", ra_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui konfigurasi tahun ajaran: {exc}",
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    return {
        "success": True,
        "message": "Konfigurasi tahun ajaran berhasil diperbarui",
        "data": response.data[0],
    }


@router.get("/{tahun_ajaran_id}/kalender", response_model=KalenderPendidikanListResponse)
def list_kalender_pendidikan(
    tahun_ajaran_id: str,
    current=Depends(get_current_user_profile),
):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    target = _find_tahun_ajaran(supabase, ra_id, tahun_ajaran_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    try:
        events = fetch_calendar_events(supabase, ra_id, tahun_ajaran_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat kalender pendidikan: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Kalender pendidikan berhasil dimuat",
        "data": events,
    }


@router.post("/{tahun_ajaran_id}/kalender/sync-kemenag", response_model=KalenderPendidikanListResponse)
def sync_kalender_kemenag(
    tahun_ajaran_id: str,
    payload: KalenderPendidikanSyncRequest,
    current=Depends(get_current_user_profile),
):
    _ensure_manage_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    target = _find_tahun_ajaran(supabase, ra_id, tahun_ajaran_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    try:
        events = sync_kemenag_calendar(
            supabase,
            ra_id,
            target,
            user_id,
            replace_existing=payload.replace_existing,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal sinkronisasi kalender Kemenag: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Kalender pendidikan Kemenag berhasil disinkronkan",
        "data": events,
    }


@router.post("/{tahun_ajaran_id}/kalender/manual", response_model=KalenderPendidikanListResponse, status_code=status.HTTP_201_CREATED)
def add_manual_calendar_event(
    tahun_ajaran_id: str,
    payload: KalenderPendidikanCreateRequest,
    current=Depends(get_current_user_profile),
):
    _ensure_manage_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    target = _find_tahun_ajaran(supabase, ra_id, tahun_ajaran_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    parsed_tanggal = parse_date(payload.tanggal)
    if not parsed_tanggal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format tanggal tidak valid. Gunakan YYYY-MM-DD",
        )

    nama_event = (payload.nama_event or "").strip()
    if not nama_event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nama event kalender wajib diisi",
        )

    is_holiday = bool(payload.is_holiday)

    try:
        (
            supabase.table("kalender_pendidikan")
            .upsert(
                {
                    "ra_id": ra_id,
                    "tahun_ajaran_id": tahun_ajaran_id,
                    "tanggal": str(parsed_tanggal),
                    "nama_event": nama_event,
                    "is_holiday": is_holiday,
                    "sumber": "manual",
                    "keterangan": payload.keterangan,
                    "created_by": user_id,
                },
                on_conflict="tahun_ajaran_id,tanggal,nama_event,sumber",
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menambah event kalender manual: {exc}",
        ) from exc

    events = fetch_calendar_events(supabase, ra_id, tahun_ajaran_id)
    return {
        "success": True,
        "message": "Event kalender manual berhasil ditambahkan",
        "data": events,
    }


@router.delete("/{tahun_ajaran_id}/kalender/{kalender_id}", response_model=KalenderPendidikanDeleteResponse)
def delete_kalender_event(
    tahun_ajaran_id: str,
    kalender_id: str,
    current=Depends(get_current_user_profile),
):
    _ensure_manage_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    target = _find_tahun_ajaran(supabase, ra_id, tahun_ajaran_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan",
        )

    try:
        response = (
            supabase.table("kalender_pendidikan")
            .delete()
            .eq("id", kalender_id)
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus event kalender pendidikan: {exc}",
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event kalender pendidikan tidak ditemukan",
        )

    return {
        "success": True,
        "message": "Event kalender pendidikan berhasil dihapus",
        "data": {"id": kalender_id},
    }
