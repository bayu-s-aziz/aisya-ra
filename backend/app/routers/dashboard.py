from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase_client
from app.utils.auth import get_current_user_profile

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _start_of_week(target: date) -> date:
    return target - timedelta(days=target.weekday())


def _count_rpph_for_guru(supabase, guru_id: str, start_date: date, end_date: date) -> int:
    response = (
        supabase.table("rpph")
        .select("id", count="exact")
        .eq("guru_id", guru_id)
        .gte("tanggal", str(start_date))
        .lte("tanggal", str(end_date))
        .execute()
    )
    return response.count or 0


def _count_catatan_for_guru_optional(supabase, guru_id: str, start_date: date, end_date: date) -> tuple[int, str]:
    try:
        response = (
            supabase.table("catatan_anekdot")
            .select("id", count="exact")
            .eq("guru_id", guru_id)
            .gte("tanggal", str(start_date))
            .lte("tanggal", str(end_date))
            .execute()
        )
        return response.count or 0, "catatan"
    except Exception:
        fallback_count = _count_rpph_for_guru(supabase, guru_id, start_date, end_date)
        return fallback_count, "rpph_fallback"


def _get_active_students_in_ra(supabase, ra_id: str):
    siswa_response = (
        supabase.table("siswa")
        .select("id,nama,kelompok_id,kelompok:kelompok_id(id,nama_kelompok,ra_id)")
        .eq("status_aktif", True)
        .execute()
    )

    result = []
    for siswa in siswa_response.data or []:
        kelompok = siswa.get("kelompok")
        if kelompok and kelompok.get("ra_id") == ra_id:
            result.append(
                {
                    "id": siswa["id"],
                    "nama": siswa["nama"],
                    "kelompok_id": siswa.get("kelompok_id"),
                    "kelompok_nama": kelompok.get("nama_kelompok"),
                }
            )
    return result


def _get_students_without_catatan_7_days_optional(supabase, ra_id: str, today: date):
    students = _get_active_students_in_ra(supabase, ra_id)
    if not students:
        return [], "catatan"

    start_date = today - timedelta(days=7)

    try:
        catatan_response = (
            supabase.table("catatan_anekdot")
            .select("siswa_id")
            .gte("tanggal", str(start_date))
            .lte("tanggal", str(today))
            .execute()
        )
        siswa_with_catatan = {item["siswa_id"] for item in (catatan_response.data or []) if item.get("siswa_id")}
        source = "catatan"
    except Exception:
        presensi_response = (
            supabase.table("presensi")
            .select("siswa_id")
            .gte("tanggal", str(start_date))
            .lte("tanggal", str(today))
            .execute()
        )
        siswa_with_catatan = {item["siswa_id"] for item in (presensi_response.data or []) if item.get("siswa_id")}
        source = "presensi_fallback"

    without_catatan = [
        {
            "siswa_id": siswa["id"],
            "nama": siswa["nama"],
            "kelompok_id": siswa.get("kelompok_id"),
            "kelompok_nama": siswa.get("kelompok_nama"),
        }
        for siswa in students
        if siswa["id"] not in siswa_with_catatan
    ]

    return without_catatan, source


@router.get("/guru")
def get_dashboard_guru(current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    profile = current["profile"]
    guru_id = profile["profile"]["id"]
    ra_id = current["ra_id"]

    today = date.today()
    start_week = _start_of_week(today)

    try:
        rpph_today_count = (
            supabase.table("rpph")
            .select("id", count="exact")
            .eq("guru_id", guru_id)
            .eq("tanggal", str(today))
            .execute()
            .count
            or 0
        )

        catatan_week_count, catatan_source = _count_catatan_for_guru_optional(
            supabase, guru_id, start_week, today
        )

        siswa_tanpa_catatan, siswa_tanpa_catatan_source = _get_students_without_catatan_7_days_optional(
            supabase, ra_id, today
        )

        kelompok_response = (
            supabase.table("kelompok")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .order("nama_kelompok")
            .execute()
        )

        rekap_per_kelompok = []
        total_rekap = {
            "hadir": 0,
            "sakit": 0,
            "izin": 0,
            "alpha": 0,
            "belum_dicatat": 0,
            "total_siswa": 0,
        }

        for kelompok in kelompok_response.data or []:
            siswa_response = (
                supabase.table("siswa")
                .select("id", count="exact")
                .eq("kelompok_id", kelompok["id"])
                .eq("status_aktif", True)
                .execute()
            )
            total_siswa = siswa_response.count or 0

            siswa_ids_response = (
                supabase.table("siswa")
                .select("id")
                .eq("kelompok_id", kelompok["id"])
                .eq("status_aktif", True)
                .execute()
            )
            siswa_ids = [item["id"] for item in (siswa_ids_response.data or [])]

            hadir = sakit = izin = alpha = 0
            belum_dicatat = total_siswa

            if siswa_ids:
                presensi_response = (
                    supabase.table("presensi")
                    .select("siswa_id,status")
                    .eq("tanggal", str(today))
                    .in_("siswa_id", siswa_ids)
                    .execute()
                )

                for p in presensi_response.data or []:
                    status_presensi = p.get("status")
                    if status_presensi == "hadir":
                        hadir += 1
                    elif status_presensi == "sakit":
                        sakit += 1
                    elif status_presensi == "izin":
                        izin += 1
                    elif status_presensi == "alpha":
                        alpha += 1

                belum_dicatat = max(total_siswa - len(presensi_response.data or []), 0)

            rekap_per_kelompok.append(
                {
                    "kelompok_id": kelompok["id"],
                    "kelompok_nama": kelompok["nama_kelompok"],
                    "total_siswa": total_siswa,
                    "hadir": hadir,
                    "sakit": sakit,
                    "izin": izin,
                    "alpha": alpha,
                    "belum_dicatat": belum_dicatat,
                }
            )

            total_rekap["hadir"] += hadir
            total_rekap["sakit"] += sakit
            total_rekap["izin"] += izin
            total_rekap["alpha"] += alpha
            total_rekap["belum_dicatat"] += belum_dicatat
            total_rekap["total_siswa"] += total_siswa

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat dashboard guru: {exc}",
        ) from exc

    return {
        "success": True,
        "data": {
            "rpph_hari_ini": {
                "tanggal": str(today),
                "sudah_buat": rpph_today_count > 0,
                "jumlah": rpph_today_count,
            },
            "jumlah_catatan_minggu_ini": catatan_week_count,
            "catatan_source": catatan_source,
            "siswa_tanpa_catatan_7_hari": {
                "jumlah": len(siswa_tanpa_catatan),
                "source": siswa_tanpa_catatan_source,
                "items": siswa_tanpa_catatan,
            },
            "rekap_presensi_hari_ini": {
                "tanggal": str(today),
                "total": total_rekap,
                "per_kelompok": rekap_per_kelompok,
            },
        },
    }


@router.get("/kepala")
def get_dashboard_kepala(current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    profile = current["profile"]
    role = (profile.get("role") or "").lower()
    ra_id = current["ra_id"]

    if role not in {"kepala_ra", "kepala", "admin", "admin_ra"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Kepala RA/Admin yang bisa mengakses dashboard ini",
        )

    today = date.today()
    start_week = _start_of_week(today)

    try:
        guru_response = (
            supabase.table("profiles")
            .select("id,nama,email,role")
            .eq("ra_id", ra_id)
            .execute()
        )
        guru_list = [
            g for g in (guru_response.data or []) if (g.get("role") or "").lower() in {"guru", "guru_ra"}
        ]

        summary_per_guru = []
        for guru in guru_list:
            rpph_today = (
                supabase.table("rpph")
                .select("id", count="exact")
                .eq("guru_id", guru["id"])
                .eq("tanggal", str(today))
                .execute()
                .count
                or 0
            )
            rpph_week = _count_rpph_for_guru(supabase, guru["id"], start_week, today)
            catatan_week, catatan_source = _count_catatan_for_guru_optional(
                supabase, guru["id"], start_week, today
            )
            presensi_dicatat = (
                supabase.table("presensi")
                .select("id", count="exact")
                .eq("dicatat_oleh", guru["id"])
                .eq("tanggal", str(today))
                .execute()
                .count
                or 0
            )

            summary_per_guru.append(
                {
                    "guru_id": guru["id"],
                    "nama": guru.get("nama"),
                    "email": guru.get("email"),
                    "rpph_hari_ini": rpph_today,
                    "rpph_minggu_ini": rpph_week,
                    "catatan_minggu_ini": catatan_week,
                    "catatan_source": catatan_source,
                    "presensi_dicatat_hari_ini": presensi_dicatat,
                }
            )

        kelas_response = (
            supabase.table("kelompok")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .order("nama_kelompok")
            .execute()
        )

        summary_per_kelas = []
        for kelas in kelas_response.data or []:
            siswa_count = (
                supabase.table("siswa")
                .select("id", count="exact")
                .eq("kelompok_id", kelas["id"])
                .eq("status_aktif", True)
                .execute()
                .count
                or 0
            )

            rpph_week_kelas = (
                supabase.table("rpph")
                .select("id", count="exact")
                .eq("kelompok_id", kelas["id"])
                .gte("tanggal", str(start_week))
                .lte("tanggal", str(today))
                .execute()
                .count
                or 0
            )

            siswa_ids_response = (
                supabase.table("siswa")
                .select("id")
                .eq("kelompok_id", kelas["id"])
                .eq("status_aktif", True)
                .execute()
            )
            siswa_ids = [x["id"] for x in (siswa_ids_response.data or [])]

            presensi_tercatat = 0
            if siswa_ids:
                presensi_tercatat = (
                    supabase.table("presensi")
                    .select("id", count="exact")
                    .eq("tanggal", str(today))
                    .in_("siswa_id", siswa_ids)
                    .execute()
                    .count
                    or 0
                )

            summary_per_kelas.append(
                {
                    "kelompok_id": kelas["id"],
                    "nama_kelas": kelas["nama_kelompok"],
                    "jumlah_siswa": siswa_count,
                    "jumlah_rpph_minggu_ini": rpph_week_kelas,
                    "jumlah_presensi_hari_ini": presensi_tercatat,
                }
            )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat dashboard kepala: {exc}",
        ) from exc

    return {
        "success": True,
        "data": {
            "tanggal": str(today),
            "summary_per_guru": summary_per_guru,
            "summary_per_kelas": summary_per_kelas,
        },
    }
