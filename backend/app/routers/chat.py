import json
from datetime import date, datetime, timedelta, timezone
import re
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.database import get_supabase_client
from app.models.chat import (
    DeleteChatRoomResponse,
    ChatMessagesResponse,
    ChatRoomListResponse,
    CreateChatRoomRequest,
    CreateChatRoomResponse,
    SendMessageRequest,
    SendMessageResponse,
    VoiceMessageResponse,
)
from app.utils.auth import get_current_user_profile
from app.utils.gemini import generate_response
from app.utils.whisper import transcribe_audio
from app.utils.retrieval import retrieve_relevant_context, build_rag_prompt
from app.routers.dashboard import get_dashboard_guru, get_dashboard_kepala
from app.utils.academic_year import get_active_academic_year
from app.utils.dashboard_chat_formatter import (
    build_dashboard_text_from_endpoint,
    is_refresh_command,
)

router = APIRouter()


VALID_TIPE = {'utama', 'rpph', 'anekdot', 'surat', 'presensi', 'custom', 'dashboard'}
VALID_PRESENSI_STATUS = {"hadir", "sakit", "izin", "alpha"}


def _is_valid_uuid(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except Exception:
        return False


def _build_dashboard_text_from_endpoint(current: dict, refreshed: bool) -> str:
    return build_dashboard_text_from_endpoint(
        current=current,
        refreshed=refreshed,
        guru_endpoint=get_dashboard_guru,
        kepala_endpoint=get_dashboard_kepala,
    )


def _normalize_text(value: str) -> str:
    lowered = (value or "").strip().lower().replace("_", " ")
    return re.sub(r"\s+", " ", lowered)


def _looks_like_student_query(query: str) -> bool:
    normalized_query = _normalize_text(query)
    keywords = [
        "siswa",
        "murid",
        "peserta didik",
        "kelompok",
        "rombel",
        "daftar anak",
    ]
    return any(keyword in normalized_query for keyword in keywords)


def _contains_any(query: str, keywords: list[str]) -> bool:
    normalized_query = _normalize_text(query)
    return any(keyword in normalized_query for keyword in keywords)


def _is_requesting_all_data(query: str) -> bool:
    return _contains_any(
        query,
        [
            "semua data",
            "seluruh data",
            "data sistem",
            "laporan lengkap",
            "ringkasan semua",
            "semua informasi",
        ],
    )


def _is_admin_role(role: str) -> bool:
    return (role or "").lower() in {"kepala_ra", "kepala", "admin", "admin_ra"}


def _build_students_context(supabase, ra_id: str, tahun_ajaran_id: str, query: str) -> str | None:
    if not _looks_like_student_query(query):
        return None

    try:
        kelompok_resp = (
            supabase.table("kelompok")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .order("nama_kelompok")
            .execute()
        )
        kelompok_list = kelompok_resp.data or []
    except Exception:
        return None

    if not kelompok_list:
        return "Data kelompok belum tersedia pada manajemen siswa."

    normalized_query = _normalize_text(query)
    matched_kelompok = None
    for kelompok in kelompok_list:
        nama_kelompok = kelompok.get("nama_kelompok") or ""
        normalized_kelompok = _normalize_text(nama_kelompok)
        if normalized_kelompok and (normalized_kelompok in normalized_query or normalized_query in normalized_kelompok):
            matched_kelompok = kelompok
            break

    try:
        siswa_query = (
            supabase.table("siswa")
            .select("nama,nisn,status_aktif,kelompok_id,tingkat_rombel")
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .order("nama")
        )
        if matched_kelompok:
            siswa_query = siswa_query.eq("kelompok_id", matched_kelompok["id"])

        siswa_resp = siswa_query.limit(200).execute()
        siswa_list = siswa_resp.data or []
    except Exception:
        return None

    if matched_kelompok:
        kelompok_label = matched_kelompok.get("nama_kelompok") or "(tanpa nama)"
    else:
        kelompok_label = "SEMUA KELOMPOK"

    if not siswa_list:
        if matched_kelompok:
            return f"Tidak ada data siswa untuk kelompok {kelompok_label}."
        return "Belum ada data siswa pada manajemen siswa."

    siswa_lines = []
    for idx, siswa in enumerate(siswa_list, start=1):
        nisn = siswa.get("nisn") or "-"
        status = "Aktif" if siswa.get("status_aktif") else "Nonaktif"
        rombel = siswa.get("tingkat_rombel") or "-"
        siswa_lines.append(f"{idx}. {siswa.get('nama') or '-'} | NISN: {nisn} | Kelompok: {rombel} | Status: {status}")

    available_kelompok = ", ".join([(item.get("nama_kelompok") or "-") for item in kelompok_list])

    return (
        f"Daftar kelompok tersedia: {available_kelompok}\n"
        f"Kelompok yang dipakai untuk jawaban: {kelompok_label}\n"
        f"Total siswa di konteks: {len(siswa_list)}\n"
        "Data siswa:\n"
        + "\n".join(siswa_lines)
    )


def _build_users_context(supabase, ra_id: str, can_view_sensitive: bool) -> str | None:
    try:
        response = (
            supabase.table("profiles")
            .select("id,nama,email,role,jabatan,telepon")
            .eq("ra_id", ra_id)
            .order("nama")
            .limit(120)
            .execute()
        )
        users = response.data or []
    except Exception:
        return None

    if not users:
        return "Belum ada data pengguna/guru pada RA ini."

    lines = []
    for idx, user in enumerate(users, start=1):
        role = (user.get("role") or "-").lower()
        jabatan = user.get("jabatan") or "-"
        if can_view_sensitive:
            telepon = user.get("telepon") or "-"
            lines.append(
                f"{idx}. {user.get('nama') or '-'} | Role: {role} | Jabatan: {jabatan} | "
                f"Email: {user.get('email') or '-'} | Telepon: {telepon}"
            )
        else:
            lines.append(f"{idx}. {user.get('nama') or '-'} | Role: {role} | Jabatan: {jabatan}")

    if can_view_sensitive:
        return f"Total pengguna/guru: {len(users)}\nData pengguna:\n" + "\n".join(lines)

    return (
        f"Total pengguna/guru: {len(users)}\n"
        "Data pengguna (mode terbatas untuk role non-admin):\n"
        + "\n".join(lines)
    )


def _build_presensi_context(supabase, ra_id: str, tahun_ajaran_id: str) -> str | None:
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        siswa_resp = (
            supabase.table("siswa")
            .select("id,nama,kelompok_id")
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .eq("status_aktif", True)
            .execute()
        )
        siswa_list = siswa_resp.data or []
        siswa_ids = [item.get("id") for item in siswa_list if item.get("id")]

        if not siswa_ids:
            return "Belum ada siswa aktif untuk data presensi."

        presensi_resp = (
            supabase.table("presensi")
            .select("siswa_id,status")
            .eq("tanggal", today)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .in_("siswa_id", siswa_ids)
            .execute()
        )
        presensi_rows = presensi_resp.data or []
    except Exception:
        return None

    total = len(siswa_ids)
    hadir = sum(1 for row in presensi_rows if row.get("status") == "hadir")
    sakit = sum(1 for row in presensi_rows if row.get("status") == "sakit")
    izin = sum(1 for row in presensi_rows if row.get("status") == "izin")
    alpha = sum(1 for row in presensi_rows if row.get("status") == "alpha")
    belum = max(total - len(presensi_rows), 0)

    return (
        f"Rekap presensi tanggal {today}: total_siswa={total}, hadir={hadir}, sakit={sakit}, "
        f"izin={izin}, alpha={alpha}, belum_dicatat={belum}"
    )


def _build_rpph_context(supabase, ra_id: str, tahun_ajaran_id: str) -> str | None:
    try:
        guru_resp = (
            supabase.table("profiles")
            .select("id")
            .eq("ra_id", ra_id)
            .execute()
        )
        guru_ids = [item.get("id") for item in (guru_resp.data or []) if item.get("id")]
        if not guru_ids:
            return "Belum ada guru untuk data RPPH."

        rpph_resp = (
            supabase.table("rpph")
            .select("id,guru_id,tanggal,tema,subtema")
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .in_("guru_id", guru_ids)
            .order("tanggal", desc=True)
            .limit(20)
            .execute()
        )
        rpph_list = rpph_resp.data or []
    except Exception:
        return None

    if not rpph_list:
        return "Belum ada data RPPH."

    lines = []
    for idx, item in enumerate(rpph_list[:10], start=1):
        lines.append(f"{idx}. tanggal={item.get('tanggal')} | tema={item.get('tema') or '-'} | subtema={item.get('subtema') or '-'}")

    return f"Total RPPH terbaru: {len(rpph_list)}\nContoh data:\n" + "\n".join(lines)


def _build_surat_context(supabase, ra_id: str) -> str | None:
    try:
        surat_resp = (
            supabase.table("surat")
            .select("id,nomor_surat,judul,created_at")
            .eq("ra_id", ra_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        surat_list = surat_resp.data or []
    except Exception:
        return None

    if not surat_list:
        return "Belum ada data surat."

    lines = []
    for idx, item in enumerate(surat_list[:10], start=1):
        lines.append(f"{idx}. {item.get('nomor_surat') or '-'} | {item.get('judul') or '-'} | {item.get('created_at') or '-'}")

    return f"Total surat: {len(surat_list)}\nSurat terbaru:\n" + "\n".join(lines)


def _build_template_surat_context(supabase, ra_id: str) -> str | None:
    try:
        template_resp = (
            supabase.table("template_surat")
            .select("id,nama_template,jenis_surat")
            .eq("ra_id", ra_id)
            .order("nama_template")
            .limit(50)
            .execute()
        )
        templates = template_resp.data or []
    except Exception:
        return None

    if not templates:
        return "Belum ada template surat."

    lines = []
    for idx, item in enumerate(templates[:12], start=1):
        lines.append(f"{idx}. {item.get('nama_template') or '-'} | jenis={item.get('jenis_surat') or '-'}")

    return f"Total template surat: {len(templates)}\nTemplate tersedia:\n" + "\n".join(lines)


def _build_knowledge_context(supabase, ra_id: str) -> str | None:
    try:
        docs_resp = (
            supabase.table("knowledge_docs")
            .select("id,nama_file,uploaded_at")
            .eq("ra_id", ra_id)
            .order("uploaded_at", desc=True)
            .limit(20)
            .execute()
        )
        docs = docs_resp.data or []
    except Exception:
        return None

    if not docs:
        return "Belum ada dokumen knowledge base."

    lines = []
    for idx, item in enumerate(docs[:10], start=1):
        lines.append(f"{idx}. {item.get('nama_file') or '-'} | uploaded_at={item.get('uploaded_at') or '-'}")

    return f"Total dokumen knowledge: {len(docs)}\nDokumen terbaru:\n" + "\n".join(lines)


def _build_notifikasi_context(supabase, user_id: str) -> str | None:
    try:
        notif_resp = (
            supabase.table("notifikasi")
            .select("id,judul,dibaca,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        notif_list = notif_resp.data or []
    except Exception:
        return None

    if not notif_list:
        return "Tidak ada notifikasi untuk user ini."

    unread = sum(1 for item in notif_list if not item.get("dibaca"))
    lines = []
    for idx, item in enumerate(notif_list[:8], start=1):
        status_notif = "belum_dibaca" if not item.get("dibaca") else "dibaca"
        lines.append(f"{idx}. {item.get('judul') or '-'} | status={status_notif} | {item.get('created_at') or '-'}")

    return f"Total notifikasi terbaru: {len(notif_list)} | belum dibaca: {unread}\nDetail notifikasi:\n" + "\n".join(lines)


def _build_chat_rooms_context(supabase, ra_id: str) -> str | None:
    try:
        room_resp = (
            supabase.table("chat_rooms")
            .select("id,nama,tipe")
            .eq("ra_id", ra_id)
            .order("nama")
            .limit(60)
            .execute()
        )
        rooms = room_resp.data or []
    except Exception:
        return None

    if not rooms:
        return "Belum ada chat room pada RA ini."

    lines = []
    for idx, item in enumerate(rooms[:12], start=1):
        lines.append(f"{idx}. {item.get('nama') or '-'} | tipe={item.get('tipe') or '-'}")

    return f"Total chat room: {len(rooms)}\nDaftar room:\n" + "\n".join(lines)


def _build_system_data_context(supabase, current: dict, query: str) -> str | None:
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]
    role = (current.get("profile") or {}).get("role") or ""
    can_view_sensitive = _is_admin_role(role)
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]

    request_all_data = _is_requesting_all_data(query)
    sections = []

    if request_all_data or _looks_like_student_query(query):
        students = _build_students_context(supabase, ra_id, tahun_ajaran_id, query)
        if students:
            sections.append(("MANAJEMEN SISWA", students))

    if request_all_data or _contains_any(query, ["guru", "pengguna", "user", "akun", "pegawai", "gtk"]):
        users = _build_users_context(supabase, ra_id, can_view_sensitive=can_view_sensitive)
        if users:
            sections.append(("MANAJEMEN PENGGUNA/GURU", users))

    if request_all_data or _contains_any(query, ["presensi", "kehadiran", "hadir", "izin", "sakit", "alpha"]):
        presensi = _build_presensi_context(supabase, ra_id, tahun_ajaran_id)
        if presensi:
            sections.append(("PRESENSI", presensi))

    if request_all_data or _contains_any(query, ["rpph", "rencana pembelajaran", "tema", "subtema"]):
        rpph = _build_rpph_context(supabase, ra_id, tahun_ajaran_id)
        if rpph:
            sections.append(("RPPH", rpph))

    if request_all_data or _contains_any(query, ["surat", "nomor surat", "arsip surat"]):
        surat = _build_surat_context(supabase, ra_id)
        if surat:
            sections.append(("SURAT", surat))

    if request_all_data or _contains_any(query, ["template surat", "template"]):
        template_surat = _build_template_surat_context(supabase, ra_id)
        if template_surat:
            sections.append(("TEMPLATE SURAT", template_surat))

    if request_all_data or _contains_any(query, ["knowledge", "dokumen", "materi", "kb"]):
        knowledge = _build_knowledge_context(supabase, ra_id)
        if knowledge:
            sections.append(("KNOWLEDGE BASE", knowledge))

    if request_all_data or _contains_any(query, ["notifikasi", "pemberitahuan"]):
        notifikasi = _build_notifikasi_context(supabase, user_id)
        if notifikasi:
            sections.append(("NOTIFIKASI", notifikasi))

    if request_all_data or _contains_any(query, ["room", "chat room", "ruang chat"]):
        rooms = _build_chat_rooms_context(supabase, ra_id)
        if rooms:
            sections.append(("CHAT ROOM", rooms))

    if request_all_data and not can_view_sensitive:
        sections.append(
            (
                "BATAS AKSES",
                "Sebagian data sensitif (mis. detail kontak pengguna) dibatasi untuk role Kepala/Admin.",
            )
        )

    if not sections:
        return None

    return "\n\n".join([f"[{title}]\n{content}" for title, content in sections])


def _normalize_presensi_status(value: str | None) -> str | None:
    normalized = _normalize_text(value or "")
    if not normalized:
        return None

    if normalized in VALID_PRESENSI_STATUS:
        return normalized

    if normalized in {"alfa", "tanpa keterangan", "tidak hadir", "tidak masuk", "absen"}:
        return "alpha"

    return None


def _parse_date_value(value: str | None) -> str | None:
    normalized = _normalize_text(value or "")
    if not normalized:
        return None

    if normalized in {"hari ini", "today", "sekarang"}:
        return date.today().isoformat()
    if normalized in {"kemarin", "yesterday"}:
        return (date.today() - timedelta(days=1)).isoformat()

    raw_value = (value or "").strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw_value, fmt).date().isoformat()
        except ValueError:
            continue

    return None


def _parse_json_object(text: str) -> dict | None:
    if not text:
        return None

    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        snippet = cleaned[start:end + 1]
        try:
            parsed = json.loads(snippet)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return None

    return None


def _detect_admin_action_intent(query: str) -> str | None:
    normalized = _normalize_text(query)

    create_student = (
        _contains_any(normalized, ["siswa", "murid", "peserta didik"])
        and _contains_any(normalized, ["tambah", "tambahkan", "daftarkan", "input", "masukkan", "buat"])
    )
    if create_student:
        return "create_student"

    attendance_action = (
        _contains_any(normalized, ["presensi", "kehadiran", "tidak hadir", "tidak masuk", "izin", "sakit", "alpha", "alfa"])
        and _contains_any(normalized, ["catat", "tandai", "input", "set", "ubah", "update", "masukkan", "tolong"])
    )
    if attendance_action:
        return "mark_attendance"

    return None


def _resolve_kelompok_by_name(kelompok_rows: list[dict], nama_kelompok: str) -> tuple[dict | None, list[str]]:
    normalized_target = _normalize_text(nama_kelompok)
    if not normalized_target:
        return None, []

    exact = [
        item
        for item in kelompok_rows
        if _normalize_text(item.get("nama_kelompok") or "") == normalized_target
    ]
    if len(exact) == 1:
        return exact[0], []

    partial = [
        item
        for item in kelompok_rows
        if normalized_target in _normalize_text(item.get("nama_kelompok") or "")
        or _normalize_text(item.get("nama_kelompok") or "") in normalized_target
    ]
    if len(partial) == 1:
        return partial[0], []

    candidates = partial if partial else exact
    candidate_names = [(item.get("nama_kelompok") or "-") for item in candidates[:6]]
    return None, candidate_names


def _resolve_student_for_action(
    supabase,
    ra_id: str,
    tahun_ajaran_id: str,
    nama_siswa: str,
    kelompok_id: str | None = None,
) -> tuple[dict | None, str | None, list[str]]:
    query = (
        supabase.table("siswa")
        .select("id,nama,kelompok_id,tingkat_rombel")
        .eq("ra_id", ra_id)
        .eq("tahun_ajaran_id", tahun_ajaran_id)
        .eq("status_aktif", True)
        .ilike("nama", f"%{nama_siswa}%")
        .limit(20)
    )
    if kelompok_id:
        query = query.eq("kelompok_id", kelompok_id)

    response = query.execute()
    rows = response.data or []

    if not rows:
        return None, "not_found", []

    normalized_target = _normalize_text(nama_siswa)
    exact = [row for row in rows if _normalize_text(row.get("nama") or "") == normalized_target]
    candidates = exact if exact else rows

    if len(candidates) == 1:
        return candidates[0], None, []

    candidate_names = [(row.get("nama") or "-") for row in candidates[:6]]
    return None, "ambiguous", candidate_names


def _extract_attendance_records(query: str) -> list[dict]:
    extraction_prompt = f"""Ekstrak data presensi dari pesan user menjadi JSON.

Aturan:
- Fokus hanya pada aksi pencatatan presensi/tidak hadir.
- Jangan membuat data baru yang tidak disebut user.
- Status valid hanya: sakit, izin, alpha.
- Jika user hanya bilang "tidak hadir/tidak masuk/absen" tanpa alasan, gunakan status alpha.
- Tanggal harus format YYYY-MM-DD jika disebut jelas. Jika tidak disebut, isi null.

Format output WAJIB persis JSON object:
{{
  "records": [
    {{"nama_siswa": "...", "status": "sakit|izin|alpha", "tanggal": "YYYY-MM-DD|null", "keterangan": "...|null"}}
  ]
}}

Jika tidak ada data yang jelas, kembalikan: {{"records": []}}

Pesan user: {query}
Output JSON saja:"""

    try:
        raw = generate_response(extraction_prompt)
    except Exception:
        return []

    parsed = _parse_json_object(raw) or {}
    records = parsed.get("records") if isinstance(parsed, dict) else None
    if not isinstance(records, list):
        return []

    normalized_records = []
    for item in records:
        if not isinstance(item, dict):
            continue

        nama_siswa = (item.get("nama_siswa") or "").strip()
        if not nama_siswa:
            continue

        status = _normalize_presensi_status(item.get("status"))
        if not status and _contains_any(query, ["tidak hadir", "tidak masuk", "absen"]):
            status = "alpha"

        normalized_records.append(
            {
                "nama_siswa": nama_siswa,
                "status": status,
                "tanggal": _parse_date_value(item.get("tanggal")),
                "keterangan": ((item.get("keterangan") or "").strip() or None),
            }
        )

    return normalized_records


def _extract_new_students(query: str) -> list[dict]:
    extraction_prompt = f"""Ekstrak data siswa baru dari pesan user menjadi JSON.

Aturan:
- Fokus hanya jika user meminta tambah/daftarkan siswa.
- Jangan mengarang nama siswa atau kelompok.
- Jika data tidak disebut, isi null.

Format output WAJIB persis JSON object:
{{
  "records": [
    {{
      "nama_siswa": "...",
      "nama_kelompok": "...",
      "nisn": "...|null",
      "jenis_kelamin": "...|null"
    }}
  ]
}}

Jika tidak ada data yang jelas, kembalikan: {{"records": []}}

Pesan user: {query}
Output JSON saja:"""

    try:
        raw = generate_response(extraction_prompt)
    except Exception:
        return []

    parsed = _parse_json_object(raw) or {}
    records = parsed.get("records") if isinstance(parsed, dict) else None
    if not isinstance(records, list):
        return []

    normalized_records = []
    for item in records:
        if not isinstance(item, dict):
            continue

        nama_siswa = (item.get("nama_siswa") or "").strip()
        nama_kelompok = (item.get("nama_kelompok") or "").strip()
        if not nama_siswa:
            continue

        normalized_records.append(
            {
                "nama_siswa": nama_siswa,
                "nama_kelompok": nama_kelompok,
                "nisn": ((item.get("nisn") or "").strip() or None),
                "jenis_kelamin": ((item.get("jenis_kelamin") or "").strip() or None),
            }
        )

    return normalized_records


def _try_execute_attendance_action(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]
    tahun_ajaran_id = get_active_academic_year(supabase, ra_id, created_by=user_id)["id"]
    records = _extract_attendance_records(query)

    if not records:
        return (
            "Saya siap mencatat ketidakhadiran, tapi datanya belum lengkap. "
            "Contoh: 'Catat Ani sakit hari ini' atau 'Budi izin 2026-04-07'."
        )

    success_lines = []
    issue_lines = []

    for record in records:
        nama_siswa = record.get("nama_siswa") or ""
        status_value = record.get("status")
        tanggal_value = record.get("tanggal") or date.today().isoformat()

        if not status_value:
            issue_lines.append(f"- {nama_siswa}: status belum jelas (pilih sakit/izin/alpha).")
            continue

        try:
            siswa_row, error_kind, candidates = _resolve_student_for_action(
                supabase,
                ra_id,
                tahun_ajaran_id,
                nama_siswa,
            )
        except Exception as exc:
            issue_lines.append(f"- {nama_siswa}: gagal mencari data siswa ({exc}).")
            continue

        if error_kind == "not_found":
            issue_lines.append(f"- {nama_siswa}: siswa tidak ditemukan.")
            continue

        if error_kind == "ambiguous":
            daftar = ", ".join(candidates) if candidates else "nama serupa"
            issue_lines.append(f"- {nama_siswa}: ada beberapa nama serupa ({daftar}).")
            continue

        if not isinstance(siswa_row, dict):
            issue_lines.append(f"- {nama_siswa}: format data siswa tidak valid.")
            continue

        siswa_id = siswa_row.get("id")
        if not isinstance(siswa_id, str) or not siswa_id:
            issue_lines.append(f"- {nama_siswa}: ID siswa tidak valid.")
            continue

        siswa_nama = siswa_row.get("nama") if isinstance(siswa_row.get("nama"), str) else nama_siswa

        try:
            existing = (
                supabase.table("presensi")
                .select("id")
                .eq("siswa_id", siswa_id)
                .eq("tanggal", tanggal_value)
                .eq("tahun_ajaran_id", tahun_ajaran_id)
                .limit(1)
                .execute()
            )
            action_label = "diperbarui" if (existing.data or []) else "dicatat"

            upsert_payload = {
                "siswa_id": siswa_id,
                "tanggal": tanggal_value,
                "status": status_value,
                "dicatat_oleh": user_id,
                "keterangan": record.get("keterangan"),
                "sumber_pencatatan": "chat_ai_action",
                "tahun_ajaran_id": tahun_ajaran_id,
            }

            supabase.table("presensi").upsert(upsert_payload, on_conflict="siswa_id,tanggal").execute()
            success_lines.append(f"- {siswa_nama}: {status_value} ({tanggal_value}, {action_label}).")
        except Exception as exc:
            issue_lines.append(f"- {nama_siswa}: gagal simpan presensi ({exc}).")

    if success_lines and not issue_lines:
        return "Presensi berhasil diproses:\n" + "\n".join(success_lines)

    if success_lines and issue_lines:
        return (
            f"Presensi diproses sebagian. Berhasil: {len(success_lines)} data, perlu perbaikan: {len(issue_lines)} data.\n"
            + "\n".join(success_lines[:6])
            + "\n"
            + "\n".join(issue_lines[:6])
        )

    return "Presensi belum berhasil diproses:\n" + "\n".join(issue_lines[:6])


def _try_execute_create_student_action(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]
    tahun_ajaran_id = get_active_academic_year(supabase, ra_id, created_by=user_id)["id"]

    try:
        kelompok_rows = (
            supabase.table("kelompok")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .order("nama_kelompok")
            .execute()
        ).data or []
    except Exception as exc:
        return f"Gagal mengambil daftar kelas/kelompok: {exc}"

    if not kelompok_rows:
        return "Belum ada kelompok pada tahun ajaran aktif. Buat kelompok dulu sebelum menambah siswa."

    records = _extract_new_students(query)
    if not records:
        return (
            "Saya siap menambah siswa, tapi datanya belum lengkap. "
            "Contoh: 'Tambahkan siswa Aisyah ke Kelompok B'."
        )

    success_lines = []
    issue_lines = []
    available_kelompok = ", ".join([(item.get("nama_kelompok") or "-") for item in kelompok_rows[:10]])

    for record in records:
        nama_siswa = record.get("nama_siswa") or ""
        nama_kelompok = record.get("nama_kelompok") or ""
        if not nama_kelompok:
            issue_lines.append(f"- {nama_siswa}: nama kelompok belum disebut.")
            continue

        kelompok_row, kandidat = _resolve_kelompok_by_name(kelompok_rows, nama_kelompok)
        if not kelompok_row:
            kandidat_text = ", ".join(kandidat) if kandidat else available_kelompok
            issue_lines.append(
                f"- {nama_siswa}: kelompok '{nama_kelompok}' tidak ditemukan. Pilihan yang tersedia: {kandidat_text}."
            )
            continue

        try:
            existing = (
                supabase.table("siswa")
                .select("id,nama")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", tahun_ajaran_id)
                .eq("kelompok_id", kelompok_row["id"])
                .ilike("nama", nama_siswa)
                .limit(1)
                .execute()
            )
            if existing.data:
                issue_lines.append(
                    f"- {nama_siswa}: sudah terdaftar di {kelompok_row.get('nama_kelompok') or nama_kelompok}."
                )
                continue

            payload = {
                "ra_id": ra_id,
                "tahun_ajaran_id": tahun_ajaran_id,
                "nama": nama_siswa,
                "kelompok_id": kelompok_row["id"],
                "tingkat_rombel": kelompok_row.get("nama_kelompok"),
                "status_aktif": True,
            }
            if record.get("nisn"):
                payload["nisn"] = record["nisn"]
            if record.get("jenis_kelamin"):
                payload["jenis_kelamin"] = record["jenis_kelamin"]

            supabase.table("siswa").insert(payload).execute()
            success_lines.append(
                f"- {nama_siswa}: berhasil ditambahkan ke {kelompok_row.get('nama_kelompok') or nama_kelompok}."
            )
        except Exception as exc:
            issue_lines.append(f"- {nama_siswa}: gagal menambah siswa ({exc}).")

    if success_lines and not issue_lines:
        return "Data siswa berhasil diproses:\n" + "\n".join(success_lines)

    if success_lines and issue_lines:
        return (
            f"Penambahan siswa diproses sebagian. Berhasil: {len(success_lines)}, perlu perbaikan: {len(issue_lines)}.\n"
            + "\n".join(success_lines[:6])
            + "\n"
            + "\n".join(issue_lines[:6])
        )

    return "Belum ada siswa yang berhasil ditambahkan:\n" + "\n".join(issue_lines[:6])


def _try_execute_admin_action(supabase, current: dict, query: str) -> str | None:
    intent = _detect_admin_action_intent(query)
    if not intent:
        return None

    if intent == "mark_attendance":
        return _try_execute_attendance_action(supabase, current, query)

    if intent == "create_student":
        return _try_execute_create_student_action(supabase, current, query)

    return None


def _build_grounded_ai_response(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]

    context_chunks = retrieve_relevant_context(
        query=query,
        ra_id=ra_id,
        top_k=3,
        similarity_threshold=0.5,
    )

    if context_chunks and len(context_chunks) > 0:
        enhanced_prompt = build_rag_prompt(query, context_chunks)
    else:
        enhanced_prompt = query

    system_data_context = _build_system_data_context(supabase, current, query)
    grounding_rule = (
        "Instruksi tambahan: Jika pertanyaan user terkait data operasional RA, utamakan konteks data internal sistem ini. "
        "Jika data internal atau knowledge base tidak cukup, katakan data belum ditemukan/tersedia dan jangan menebak. "
        "Saat menjawab user, gunakan bahasa non-teknis, ringkas, dan jangan menampilkan label/field mentah "
        "seperti [PRESENSI], total_siswa, belum_dicatat, nama tabel, atau format JSON."
    )

    if system_data_context:
        enhanced_prompt = (
            f"{enhanced_prompt}\n\n"
            "KONTEKS DATA INTERNAL SISTEM (SUMBER UTAMA):\n"
            f"{system_data_context}\n\n"
            f"{grounding_rule}"
        )
    else:
        enhanced_prompt = f"{enhanced_prompt}\n\n{grounding_rule}"

    return generate_response(enhanced_prompt)


def _extract_room_tipe(rows) -> str:
    if not isinstance(rows, list) or not rows:
        return ""

    first_row = rows[0]
    if not isinstance(first_row, dict):
        return ""

    tipe_value = first_row.get("tipe")
    return tipe_value.lower() if isinstance(tipe_value, str) else ""


def _extract_rows_from_response(response) -> list[dict]:
    rows = getattr(response, "data", None)
    if not isinstance(rows, list):
        return []

    return [row for row in rows if isinstance(row, dict)]


def _save_assistant_message(supabase, user_id: str, room_id: str, content: str, error_prefix: str) -> dict:
    try:
        bot_message_response = (
            supabase.table("chat_history")
            .insert(
                {
                    "user_id": user_id,
                    "room_id": room_id,
                    "role_msg": "assistant",
                    "content": content,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )
        return bot_message_response.data[0] if bot_message_response.data else {}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{error_prefix}: {exc}",
        ) from exc


@router.post("/rooms", response_model=CreateChatRoomResponse, status_code=status.HTTP_201_CREATED)
def create_chat_room(
    payload: CreateChatRoomRequest,
    current=Depends(get_current_user_profile),
):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    created_by = current["profile"]["id"]

    nama = payload.nama.strip()
    if not nama:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nama ruang tidak boleh kosong",
        )

    tipe = payload.tipe if payload.tipe in VALID_TIPE else "custom"

    try:
        response = (
            supabase.table("chat_rooms")
            .insert({"ra_id": ra_id, "nama": nama, "tipe": tipe, "created_by": created_by})
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membuat ruang chat: {exc}",
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ruang chat gagal dibuat",
        )

    return {"success": True, "data": response.data[0]}


@router.get("/rooms", response_model=ChatRoomListResponse)
def list_chat_rooms(current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    response = None
    last_error = None
    for _ in range(2):
        try:
            response = (
                supabase.table("chat_rooms")
                .select("id,ra_id,tipe,nama")
                .eq("ra_id", ra_id)
                .order("nama")
                .execute()
            )
            break
        except Exception as exc:
            last_error = exc

    if response is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar ruang chat: {last_error}",
        ) from last_error

    return {"success": True, "data": response.data or []}


@router.delete("/rooms/{room_id}", response_model=DeleteChatRoomResponse)
def delete_chat_room(
    room_id: str,
    current=Depends(get_current_user_profile),
):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    try:
        room_check = (
            supabase.table("chat_rooms")
            .select("id")
            .eq("id", room_id)
            .eq("ra_id", ra_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memeriksa ruang chat: {exc}",
        ) from exc

    if not room_check.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ruang chat tidak ditemukan",
        )

    try:
        supabase.table("chat_history").delete().eq("room_id", room_id).execute()
        supabase.table("chat_rooms").delete().eq("id", room_id).eq("ra_id", ra_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghapus ruang chat: {exc}",
        ) from exc

    return {"success": True, "message": "Ruang chat berhasil dihapus"}


@router.get("/rooms/{room_id}/messages", response_model=ChatMessagesResponse)
def get_chat_messages(
    room_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current=Depends(get_current_user_profile),
):
    if not _is_valid_uuid(room_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ruang chat tidak ditemukan",
        )

    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    try:
        room_check = (
            supabase.table("chat_rooms")
            .select("id,tipe")
            .eq("id", room_id)
            .eq("ra_id", ra_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memeriksa ruang chat: {exc}",
        ) from exc

    if not room_check.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ruang chat tidak ditemukan",
        )

    room_tipe = _extract_room_tipe(room_check.data)
    try:
        count_response = (
            supabase.table("chat_history")
            .select("id")
            .eq("room_id", room_id)
            .execute()
        )
        total = len(_extract_rows_from_response(count_response))
        messages_data: list[dict] = []

        # --- Auto-welcome for dashboard rooms (first open only) ---
        if room_tipe == "dashboard" and total == 0:
            try:
                welcome_text = _build_dashboard_text_from_endpoint(current, refreshed=False)
                welcome_resp = (
                    supabase.table("chat_history")
                    .insert({
                        "user_id": current["profile"]["id"],
                        "room_id": room_id,
                        "role_msg": "assistant",
                        "content": welcome_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    .execute()
                )
                total = 1
                return {
                    "success": True,
                    "data": welcome_resp.data or [],
                    "page": 1,
                    "limit": limit,
                    "total": 1,
                }
            except Exception:
                pass  # fall through to normal fetch if welcome fails

        if total == 0:
            messages_data = []
        else:
            start = max(total - (page * limit), 0)
            end = total - ((page - 1) * limit) - 1

            if start > end:
                messages_data = []
            else:
                messages_response = (
                    supabase.table("chat_history")
                    .select("id,user_id,room_id,role_msg,content,timestamp")
                    .eq("room_id", room_id)
                    .order("timestamp", desc=False)
                    .range(start, end)
                    .execute()
                )
                messages_data = _extract_rows_from_response(messages_response)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil pesan chat: {exc}",
        ) from exc

    return {
        "success": True,
        "data": messages_data,
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.post("/rooms/{room_id}/messages", response_model=SendMessageResponse)
def send_chat_message(
    room_id: str,
    payload: SendMessageRequest,
    current=Depends(get_current_user_profile),
):
    if not _is_valid_uuid(room_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ruang chat tidak ditemukan",
        )

    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    try:
        room_check = (
            supabase.table("chat_rooms")
            .select("id,tipe")
            .eq("id", room_id)
            .eq("ra_id", ra_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memeriksa ruang chat: {exc}",
        ) from exc

    if not room_check.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ruang chat tidak ditemukan",
        )

    room_tipe = _extract_room_tipe(room_check.data)
    timestamp_now = datetime.now(timezone.utc).isoformat()

    try:
        user_message_response = (
            supabase.table("chat_history")
            .insert(
                {
                    "user_id": user_id,
                    "room_id": room_id,
                    "role_msg": "user",
                    "content": payload.content,
                    "timestamp": timestamp_now,
                }
            )
            .execute()
        )
        user_message = user_message_response.data[0] if user_message_response.data else {}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menyimpan pesan user: {exc}",
        ) from exc

    # -----------------------------------------------------------------------
    # Dashboard room: bypass RAG/AI, respond with role-based dashboard endpoint
    # -----------------------------------------------------------------------
    if room_tipe == "dashboard":
        requested_refresh = is_refresh_command(payload.content)

        try:
            stats_text = _build_dashboard_text_from_endpoint(current, refreshed=requested_refresh)
        except Exception as exc:
            stats_text = f"⚠️ Gagal memuat data dashboard: {exc}"

        bot_message = _save_assistant_message(
            supabase,
            user_id,
            room_id,
            stats_text,
            "Gagal menyimpan respons dashboard",
        )

        return {
            "success": True,
            "message": "Dashboard diperbarui" if requested_refresh else "Dashboard ditampilkan",
            "data": {"user_message": user_message, "bot_message": bot_message},
        }

    action_result_text = _try_execute_admin_action(supabase, current, payload.content)
    if action_result_text:
        bot_message = _save_assistant_message(
            supabase,
            user_id,
            room_id,
            action_result_text,
            "Gagal menyimpan respons aksi admin",
        )

        return {
            "success": True,
            "message": "Aksi administrasi berhasil diproses",
            "data": {
                "user_message": user_message,
                "bot_message": bot_message,
            },
        }

    try:
        ai_response_text = _build_grounded_ai_response(supabase, current, payload.content)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghasilkan respons AI: {exc}",
        ) from exc

    bot_message = _save_assistant_message(
        supabase,
        user_id,
        room_id,
        ai_response_text,
        "Gagal menyimpan respons bot",
    )

    return {
        "success": True,
        "message": "Pesan berhasil dikirim dan diproses",
        "data": {
            "user_message": user_message,
            "bot_message": bot_message,
        },
    }


@router.post("/voice", response_model=VoiceMessageResponse)
async def send_voice_message(
    room_id: str = Query(...),
    file: UploadFile = File(...),
    current=Depends(get_current_user_profile),
):
    if not _is_valid_uuid(room_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ruang chat tidak ditemukan",
        )

    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    try:
        room_check = (
            supabase.table("chat_rooms")
            .select("id,tipe")
            .eq("id", room_id)
            .eq("ra_id", ra_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memeriksa ruang chat: {exc}",
        ) from exc

    if not room_check.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ruang chat tidak ditemukan",
        )

    # Read audio file
    try:
        audio_bytes = await file.read()
        filename = file.filename or "audio.wav"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membaca file audio: {exc}",
        ) from exc

    # Transcribe audio using Whisper
    try:
        transcription = transcribe_audio(audio_bytes, filename)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mentranskrip audio: {exc}",
        ) from exc

    if not transcription or not transcription.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transkripsi audio kosong",
        )

    timestamp_now = datetime.now(timezone.utc).isoformat()

    # Save user voice message (as transcription text)
    try:
        user_message_response = (
            supabase.table("chat_history")
            .insert(
                {
                    "user_id": user_id,
                    "room_id": room_id,
                    "role_msg": "user",
                    "content": transcription,
                    "timestamp": timestamp_now,
                }
            )
            .execute()
        )
        user_message = user_message_response.data[0] if user_message_response.data else {}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menyimpan pesan voice user: {exc}",
        ) from exc

    room_tipe = _extract_room_tipe(room_check.data)

    if room_tipe == "dashboard":
        requested_refresh = is_refresh_command(transcription)

        try:
            stats_text = _build_dashboard_text_from_endpoint(current, refreshed=requested_refresh)
        except Exception as exc:
            stats_text = f"⚠️ Gagal memuat data dashboard: {exc}"

        bot_message = _save_assistant_message(
            supabase,
            user_id,
            room_id,
            stats_text,
            "Gagal menyimpan respons dashboard",
        )

        return {
            "success": True,
            "message": "Voice message berhasil diproses",
            "data": {
                "user_message": user_message,
                "bot_message": bot_message,
            },
            "transcription": transcription,
        }

    action_result_text = _try_execute_admin_action(supabase, current, transcription)
    if action_result_text:
        ai_response_text = action_result_text
    else:
        try:
            ai_response_text = _build_grounded_ai_response(supabase, current, transcription)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gagal menghasilkan respons AI: {exc}",
            ) from exc

    bot_message = _save_assistant_message(
        supabase,
        user_id,
        room_id,
        ai_response_text,
        "Gagal menyimpan respons bot",
    )

    return {
        "success": True,
        "message": "Voice message berhasil diproses",
        "data": {
            "user_message": user_message,
            "bot_message": bot_message,
        },
        "transcription": transcription,
    }
