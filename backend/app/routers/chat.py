import json
from difflib import get_close_matches
from datetime import date, datetime, timedelta, timezone
import re
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.database import get_supabase_client
from app.models.chat import (
    DeleteChatRoomResponse,
    ChatMessagesResponse,
    ChatRoomListResponse,
    CreateChatRoomRequest,
    CreateChatRoomResponse,
    ChatVocabularySettingsRequest,
    ChatVocabularySettingsResponse,
    SendMessageRequest,
    SendMessageResponse,
    VoiceMessageResponse,
)
from app.utils.auth import get_current_user_profile
from app.utils.gemini import generate_response
from app.utils.whisper import transcribe_audio
from app.utils.retrieval import retrieve_relevant_context, build_rag_prompt
from app.routers.dashboard import get_dashboard_guru, get_dashboard_kepala
from app.utils.academic_year import (
    activate_academic_year,
    get_active_academic_year,
    normalize_academic_year_label,
)
from app.utils.dashboard_chat_formatter import (
    build_dashboard_text_from_endpoint,
    is_refresh_command,
)

router = APIRouter()


VALID_TIPE = {'utama', 'rpph', 'surat', 'presensi', 'custom', 'dashboard'}
VALID_PRESENSI_STATUS = {"hadir", "sakit", "izin", "alpha"}

NATURAL_TOKEN_NORMALIZATION = {
    "g": "tidak",
    "ga": "tidak",
    "gak": "tidak",
    "gk": "tidak",
    "enggak": "tidak",
    "ngga": "tidak",
    "nggak": "tidak",
    "ndak": "tidak",
    "dak": "tidak",
    "ora": "tidak",
    "teu": "tidak",
    "henteu": "tidak",
    "mboten": "tidak",
    "tlg": "tolong",
    "plis": "tolong",
    "please": "tolong",
    "tolongin": "tolong",
    "catet": "catat",
    "catetin": "catat",
    "catatin": "catat",
    "catetkan": "catat",
    "tandain": "tandai",
    "tmbh": "tambah",
    "tmbahin": "tambah",
    "daftarin": "daftarkan",
    "masukin": "masukkan",
    "inputin": "input",
    "pindahin": "pindah",
    "geserin": "geser",
    "mutasiin": "mutasi",
    "kls": "kelas",
    "klsnya": "kelas",
    "klass": "kelas",
    "grup": "kelompok",
    "group": "kelompok",
    "rombelnya": "rombel",
    "murid": "siswa",
    "anak": "siswa",
    "anakdidik": "siswa",
    "asup": "masuk",
    "mlebu": "masuk",
    "mlebet": "masuk",
    "ijin": "izin",
    "ijinn": "izin",
    "alfa": "alpha",
    "alpa": "alpha",
    "hr": "hari",
    "ni": "ini",
    "kmrn": "kemarin",
    "skrng": "sekarang",
    "skrg": "sekarang",
    "sklh": "sekolah",
    "madrasah": "ra",
    "kamad": "kepala",
    "kepsek": "kepala",
    "kepmad": "kepala",
    "kepala_sekolah": "kepala",
    "yayasan": "penyelenggara",
    "ta": "tahun",
    "thn": "tahun",
    "th": "tahun",
}

NATURAL_PHRASE_NORMALIZATION = [
    ("tdk", "tidak"),
    ("bukan nya", "bukannya"),
    ("ta aktif", "tahun ajaran aktif"),
    ("thn ajaran", "tahun ajaran"),
    ("th ajaran", "tahun ajaran"),
    ("tahun ajrn", "tahun ajaran"),
    ("kepala sekolah", "kepala ra"),
    ("kepala madrasah", "kepala ra"),
    ("nama sekolah", "nama ra"),
    ("tak hadir", "tidak hadir"),
    ("ga hadir", "tidak hadir"),
    ("gak hadir", "tidak hadir"),
    ("nggak hadir", "tidak hadir"),
    ("ga masuk", "tidak masuk"),
    ("gak masuk", "tidak masuk"),
    ("nggak masuk", "tidak masuk"),
    ("tak masuk", "tidak masuk"),
]

NATURAL_INTENT_VOCAB = sorted(
    {
        "tolong",
        "mohon",
        "catat",
        "tandai",
        "set",
        "ubah",
        "update",
        "tambah",
        "daftarkan",
        "masukkan",
        "input",
        "pindah",
        "mutasi",
        "geser",
        "siswa",
        "kelompok",
        "kelas",
        "rombel",
        "presensi",
        "kehadiran",
        "tidak",
        "hadir",
        "masuk",
        "sakit",
        "izin",
        "alpha",
        "absen",
        "hari",
        "kemarin",
        "sekarang",
        "nama",
        "sekolah",
        "ra",
        "kepala",
        "guru",
        "gtk",
        "tahun",
        "ajaran",
        "kalender",
        "libur",
        "surat",
        "template",
        "notifikasi",
        "knowledge",
        "dokumen",
    }
)

MULTI_STEP_SEPARATOR_PATTERN = re.compile(
    r"\s*(?:\n+)\s*(?:lalu|kemudian|selanjutnya|setelah itu|habis itu|terus)\s+"
    r"|\s+(?:lalu|kemudian|selanjutnya|setelah itu|habis itu|terus)\s+",
    flags=re.IGNORECASE,
)


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


def _normalize_natural_language_query(value: str) -> str:
    normalized = _normalize_text(value)
    if not normalized:
        return ""

    for source, target in NATURAL_PHRASE_NORMALIZATION:
        normalized = re.sub(rf"\b{re.escape(source)}\b", target, normalized)

    cleaned = re.sub(r"[^a-z0-9\s\-]", " ", normalized)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return ""

    canonical_tokens = []
    for token in cleaned.split(" "):
        token_reduced = re.sub(r"(.)\1{2,}", r"\1", token)
        mapped = NATURAL_TOKEN_NORMALIZATION.get(token_reduced, token_reduced)

        if mapped == token_reduced and len(token_reduced) >= 4 and token_reduced.isalpha():
            close_match = get_close_matches(token_reduced, NATURAL_INTENT_VOCAB, n=1, cutoff=0.86)
            if close_match:
                mapped = close_match[0]

        canonical_tokens.append(mapped)

    return re.sub(r"\s+", " ", " ".join(canonical_tokens)).strip()


def _sanitize_custom_vocab_map(value: Any, max_items: int = 200) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}

    sanitized: dict[str, str] = {}
    for raw_key, raw_target in value.items():
        if len(sanitized) >= max_items:
            break

        if not isinstance(raw_key, str) or not isinstance(raw_target, str):
            continue

        key = _normalize_text(raw_key)
        target = _normalize_text(raw_target)
        if not key or not target:
            continue

        if len(key) > 60 or len(target) > 120:
            continue

        sanitized[key] = target

    return sanitized


def _load_ra_chat_vocabulary(supabase, ra_id: str) -> dict[str, dict[str, str]]:
    try:
        response = (
            supabase.table("chat_local_vocabulary")
            .select("token_map,phrase_map")
            .eq("ra_id", ra_id)
            .limit(1)
            .execute()
        )
    except Exception:
        return {"token_map": {}, "phrase_map": {}}

    if not response.data:
        return {"token_map": {}, "phrase_map": {}}

    row = response.data[0] if isinstance(response.data[0], dict) else {}
    return {
        "token_map": _sanitize_custom_vocab_map(row.get("token_map")),
        "phrase_map": _sanitize_custom_vocab_map(row.get("phrase_map")),
    }


def _apply_custom_vocabulary(query: str, vocab: dict[str, dict[str, str]] | None) -> str:
    text = (query or "").strip()
    if not text or not isinstance(vocab, dict):
        return text

    phrase_map = _sanitize_custom_vocab_map(vocab.get("phrase_map"))
    token_map = _sanitize_custom_vocab_map(vocab.get("token_map"))

    normalized = _normalize_text(text)

    # Replace longer phrases first to keep deterministic substitution.
    for src, target in sorted(phrase_map.items(), key=lambda item: len(item[0]), reverse=True):
        normalized = re.sub(rf"\b{re.escape(src)}\b", target, normalized)

    if token_map:
        def _token_replacer(match):
            token = _normalize_text(match.group(0))
            return token_map.get(token, match.group(0))

        normalized = re.sub(r"\b[a-z0-9_-]+\b", _token_replacer, normalized)

    return re.sub(r"\s+", " ", normalized).strip()


def _split_multi_step_commands(query: str) -> list[str]:
    raw = (query or "").strip()
    if not raw:
        return []

    text = re.sub(r"\s+", " ", raw)
    parts = [part.strip(" ,;.") for part in MULTI_STEP_SEPARATOR_PATTERN.split(text)]
    parts = [part for part in parts if part]

    # Fallback for clearly numbered instructions: "1. ... 2. ..."
    # Requires at least 2 items each >= 5 chars to avoid false positives on
    # ordinary sentences that happen to contain a number followed by a dot.
    if len(parts) <= 1:
        numbered_parts = [
            part.strip(" ,;.")
            for part in re.split(r"(?:^|\s+)\d+\.\s+", text)
            if part.strip(" ,;.")
        ]
        if len(numbered_parts) >= 2 and all(len(p) >= 5 for p in numbered_parts):
            return numbered_parts

    return parts


def _is_followup_step_command(step_query: str) -> bool:
    normalized = _normalize_natural_language_query(step_query)
    return _contains_any(
        normalized,
        [
            "dari hasil itu",
            "dari hasil tadi",
            "pakai data tadi",
            "gunakan hasil sebelumnya",
            "lanjutkan",
        ],
    )


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
    natural_query = _normalize_natural_language_query(query)

    for keyword in keywords:
        normalized_keyword = _normalize_text(keyword)
        if normalized_keyword and normalized_keyword in normalized_query:
            return True

        natural_keyword = _normalize_natural_language_query(keyword)
        if natural_keyword and natural_keyword in natural_query:
            return True

    return False


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
            supabase.table("kelompok_belajar")
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
            supabase.table("pengguna")
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
        siswa_map = {item["id"]: item["nama"] for item in siswa_list if item.get("id")}
        siswa_ids = list(siswa_map.keys())

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

    grouped_status: dict[str, list[str]] = {"hadir": [], "sakit": [], "izin": [], "alpha": []}
    recorded_ids = set()
    for row in presensi_rows:
        sid = row.get("siswa_id")
        status = row.get("status")
        if sid in siswa_map and status in grouped_status:
            grouped_status[status].append(siswa_map[sid])
            recorded_ids.add(sid)

    belum_dicatat = [nama for sid, nama in siswa_map.items() if sid not in recorded_ids]
    
    summary = f"Rekap presensi hari ini ({today}):\n"
    summary += f"- Hadir: {len(grouped_status['hadir'])} siswa\n"
    
    if grouped_status["sakit"]:
        summary += f"- Sakit: {', '.join(grouped_status['sakit'])}\n"
    else:
        summary += "- Sakit: -\n"
        
    if grouped_status["izin"]:
        summary += f"- Izin: {', '.join(grouped_status['izin'])}\n"
    else:
        summary += "- Izin: -\n"
        
    if grouped_status["alpha"]:
        summary += f"- Alpha: {', '.join(grouped_status['alpha'])}\n"
    else:
        summary += "- Alpha: -\n"
        
    if belum_dicatat:
        summary += f"- Belum dicatat: {len(belum_dicatat)} siswa\n"
        
    return summary


def _build_rpph_context(supabase, ra_id: str, tahun_ajaran_id: str) -> str | None:
    try:
        guru_resp = (
            supabase.table("pengguna")
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
            supabase.table("surat_keluar")
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
            supabase.table("surat_template")
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
            supabase.table("chat_ruang")
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


def _build_ra_profile_context(supabase, ra_id: str) -> str | None:
    try:
        response = (
            supabase.table("sekolah")
            .select(
                "nama_ra,nama_kepala,npsn,nomor_statistik,status_lembaga,bentuk_pendidikan,"
                "penyelenggara,akreditasi,alamat,telepon,email_lembaga,website,"
                "kelurahan_desa,kecamatan,kabupaten_kota,provinsi,kode_pos,tahun_ajaran"
            )
            .eq("id", ra_id)
            .limit(1)
            .execute()
        )
        data = response.data[0] if response.data else None
    except Exception:
        return None

    if not data:
        return "Informasi profil lembaga belum diatur."

    alamat_full = ", ".join([
        data.get("alamat") or "",
        data.get("kelurahan_desa") or "",
        data.get("kecamatan") or "",
        data.get("kabupaten_kota") or "",
        data.get("provinsi") or "",
        data.get("kode_pos") or "",
    ]).strip(", ")

    return (
        f"Nama RA: {data.get('nama_ra') or '-'}\n"
        f"Kepala RA: {data.get('nama_kepala') or '-'}\n"
        f"NPSN: {data.get('npsn') or '-'}\n"
        f"Alamat: {alamat_full or '-'}\n"
        f"Status: {data.get('status_lembaga') or '-'} | Akreditasi: {data.get('akreditasi') or '-'}\n"
        f"Kontak: Telp {data.get('telepon') or '-'} | Email {data.get('email_lembaga') or '-'} | Web {data.get('website') or '-'}"
    )


def _build_system_data_context(supabase, current: dict, query: str) -> str | None:
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]
    role = (current.get("profile") or {}).get("role") or ""
    can_view_sensitive = _is_admin_role(role)
    active_year = get_active_academic_year(supabase, ra_id, created_by=user_id)
    tahun_ajaran_id = active_year["id"]

    request_all_data = _is_requesting_all_data(query)
    sections = []

    # New section for RA Profile
    if request_all_data or _contains_any(query, ["ra", "lembaga", "sekolah", "profil", "kepala", "alamat", "npsn", "akreditasi", "madrasah", "yayasan", "paud", "tk", "kb"]):
        ra_profile = _build_ra_profile_context(supabase, ra_id)
        if ra_profile:
            sections.append(("PROFIL LEMBAGA/RA", ra_profile))

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
    normalized = _normalize_natural_language_query(value or "")
    if not normalized:
        return None

    if normalized in VALID_PRESENSI_STATUS:
        return normalized

    if any(term in normalized for term in {"alpha", "alfa", "alpa", "tanpa keterangan", "tidak hadir", "tidak masuk", "absen", "bolos", "mangkir"}):
        return "alpha"

    if "izin" in normalized:
        return "izin"

    if "sakit" in normalized:
        return "sakit"

    if normalized == "hadir":
        return "hadir"

    return None


def _parse_date_value(value: str | None) -> str | None:
    normalized = _normalize_natural_language_query(value or "")
    if not normalized:
        return None

    if normalized in {"hari ini", "today", "sekarang", "tanggal ini"}:
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


def _sanitize_person_name(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip())
    cleaned = re.sub(r"^(?:si|ananda|siswa|murid)\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^[\-,:;\s]+|[\-,:;\s]+$", "", cleaned)
    return cleaned


def _strip_name_prefix_noise(value: str) -> str:
    cleaned = _sanitize_person_name(value)
    prefix_pattern = (
        r"^(?:tolong|mohon|bantu|catat|tandai|input|set|ubah|update|masukkan|daftarkan|"
        r"pindahkan|pindah|geser|mutasi|si|siswa|murid|ananda)\s+"
    )
    previous = None
    while cleaned and previous != cleaned:
        previous = cleaned
        cleaned = re.sub(prefix_pattern, "", cleaned, flags=re.IGNORECASE).strip()
    return _sanitize_person_name(cleaned)


def _looks_like_valid_name(value: str) -> bool:
    candidate = _sanitize_person_name(value)
    if len(candidate) < 2:
        return False

    lowered = candidate.lower()
    tokens = set(lowered.split())
    stop_terms = {
        "siswa",
        "murid",
        "hadir",
        "sakit",
        "izin",
        "alpha",
        "alfa",
        "tidak hadir",
        "tidak masuk",
        "absen",
        "ke",
        "dari",
        "kelompok",
        "kelas",
        "rombel",
        "hari ini",
        "kemarin",
    }
    disallowed_tokens = {
        "tolong",
        "mohon",
        "bantu",
        "catat",
        "tandai",
        "input",
        "set",
        "ubah",
        "update",
        "masukkan",
        "daftarkan",
        "pindah",
        "mutasi",
        "geser",
    }

    if lowered in stop_terms:
        return False

    return len(tokens.intersection(disallowed_tokens)) == 0


def _split_candidate_names(raw: str) -> list[str]:
    text = _sanitize_person_name(raw)
    if not text:
        return []

    chunks = re.split(r"\s*(?:,| dan | & | serta )\s*", text, flags=re.IGNORECASE)
    names = []
    for chunk in chunks:
        name = _strip_name_prefix_noise(chunk)
        if _looks_like_valid_name(name):
            names.append(name)
    return names


def _normalize_attendance_name_candidate(value: str) -> str:
    cleaned = _strip_name_prefix_noise(value)
    cleaned = re.sub(r"^(?:hari ini|kemarin|tanggal ini|pada hari ini|pada kemarin)\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+(?:karena|sebab|dengan|yang)\s*$", "", cleaned, flags=re.IGNORECASE)
    return _sanitize_person_name(cleaned)


def _extract_attendance_records_rule_based(query: str) -> list[dict]:
    records = []
    q = _normalize_natural_language_query(query or "")
    if not q:
        return []

    date_match = re.search(r"(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}|hari ini|kemarin|tanggal ini)", q, flags=re.IGNORECASE)
    tanggal_value = _parse_date_value(date_match.group(1)) if date_match else None

    # Case 1: "Rafa tidak hadir karena sakit" / "Rafa tidak masuk".
    pattern_absent = re.compile(
        r"(?P<nama>[A-Za-z][A-Za-z' .-]{1,80}?)\s+(?:tidak hadir|tidak masuk|absen)(?:\s+(?:karena|sebab)\s+(?P<alasan>sakit|izin))?",
        flags=re.IGNORECASE,
    )
    consumed_ranges: list[tuple[int, int]] = []
    for match in pattern_absent.finditer(q):
        nama = _normalize_attendance_name_candidate(match.group("nama"))
        alasan = _normalize_presensi_status(match.group("alasan"))
        status = alasan or "alpha"
        if not _looks_like_valid_name(nama) or not status:
            continue
        consumed_ranges.append((match.start(), match.end()))
        records.append(
            {
                "nama_siswa": nama,
                "status": status,
                "tanggal": tanggal_value,
                "keterangan": None,
            }
        )

    # Case 2: "Rafa sakit" / "Rafa izin" / "Rafa hadir".
    pattern_direct_status = re.compile(
        r"(?P<nama>[A-Za-z][A-Za-z' .-]{1,80}?)\s+(?P<status>hadir|sakit|izin|alpha|alfa|alpa)\b",
        flags=re.IGNORECASE,
    )
    for match in pattern_direct_status.finditer(q):
        if any(start <= match.start() < end for start, end in consumed_ranges):
            continue

        nama = _normalize_attendance_name_candidate(match.group("nama"))
        status = _normalize_presensi_status(match.group("status"))
        if not _looks_like_valid_name(nama) or not status:
            continue
        records.append(
            {
                "nama_siswa": nama,
                "status": status,
                "tanggal": tanggal_value,
                "keterangan": None,
            }
        )

    deduped_records: list[dict] = []
    seen = set()
    for item in records:
        key = (
            _normalize_text(item.get("nama_siswa") or ""),
            _normalize_text(item.get("status") or ""),
            item.get("tanggal") or "",
        )
        if not key[0] or key in seen:
            continue
        seen.add(key)
        deduped_records.append(item)

    return deduped_records


def _extract_new_students_rule_based(query: str) -> list[dict]:
    q = (query or "").strip()
    if not q:
        return []

    patterns = [
        re.compile(
            r"(?:tambah(?:kan)?|daftarkan|input|masukkan)\s+(?:siswa\s+)?(?P<nama>.+?)\s+(?:ke|di)\s+(?:kelompok|kelas|rombel)\s+(?P<kelompok>[A-Za-z0-9 .-]{1,80})",
            flags=re.IGNORECASE,
        ),
        re.compile(
            r"(?:siswa\s+)?(?P<nama>.+?)\s+(?:masuk|gabung)\s+(?:ke|di)\s+(?:kelompok|kelas|rombel)\s+(?P<kelompok>[A-Za-z0-9 .-]{1,80})",
            flags=re.IGNORECASE,
        ),
    ]

    records = []
    for pattern in patterns:
        match = pattern.search(q)
        if not match:
            continue

        raw_names = match.group("nama")
        kelompok = _sanitize_person_name(match.group("kelompok"))
        for name in _split_candidate_names(raw_names):
            records.append(
                {
                    "nama_siswa": name,
                    "nama_kelompok": kelompok,
                    "nisn": None,
                    "jenis_kelamin": None,
                }
            )

        if records:
            return records

    return []


def _extract_transfer_students_rule_based(query: str) -> list[dict]:
    q = (query or "").strip()
    if not q:
        return []

    with_origin = re.search(
        r"(?:pindah(?:kan)?|mutasi(?:kan)?|geser(?:kan)?)\s+(?:siswa\s+)?(?P<nama>.+?)\s+dari\s+(?:kelompok|kelas|rombel)\s+(?P<asal>[A-Za-z0-9 .-]{1,80})\s+ke\s+(?:kelompok|kelas|rombel)\s+(?P<tujuan>[A-Za-z0-9 .-]{1,80})",
        q,
        flags=re.IGNORECASE,
    )
    if with_origin:
        tujuan = _sanitize_person_name(with_origin.group("tujuan"))
        asal = _sanitize_person_name(with_origin.group("asal"))
        return [
            {
                "nama_siswa": name,
                "kelompok_tujuan": tujuan,
                "kelompok_asal": asal,
            }
            for name in _split_candidate_names(with_origin.group("nama"))
        ]

    without_origin = re.search(
        r"(?:pindah(?:kan)?|mutasi(?:kan)?|geser(?:kan)?)\s+(?:siswa\s+)?(?P<nama>.+?)\s+ke\s+(?:kelompok|kelas|rombel)\s+(?P<tujuan>[A-Za-z0-9 .-]{1,80})",
        q,
        flags=re.IGNORECASE,
    )
    if without_origin:
        tujuan = _sanitize_person_name(without_origin.group("tujuan"))
        return [
            {
                "nama_siswa": name,
                "kelompok_tujuan": tujuan,
                "kelompok_asal": None,
            }
            for name in _split_candidate_names(without_origin.group("nama"))
        ]

    return []


def _iter_query_variants(query: str):
    yielded = set()
    raw = (query or "").strip()
    if raw:
        yielded.add(raw)
        yield raw

    natural = _normalize_natural_language_query(query)
    if natural and natural not in yielded:
        yield natural


def _looks_like_read_only_operational_query(query: str) -> bool:
    normalized = _normalize_natural_language_query(query)
    if not normalized:
        return False

    looks_like_info = _contains_any(
        normalized,
        [
            "rekap",
            "laporan",
            "ringkasan",
            "daftar",
            "list",
            "tampilkan",
            "berikan",
            "sebutkan",
            "siapa",
            "berapa",
            "kapan",
            "tanggal",
            "jam",
        ],
    )
    if not looks_like_info:
        return False

    has_strong_action_verb = _contains_any(
        normalized,
        [
            "catat",
            "tandai",
            "input",
            "set",
            "ubah",
            "update",
            "masukkan",
            "tambah",
            "tambahkan",
            "daftarkan",
            "pindah",
            "mutasi",
            "geser",
        ],
    )
    return not has_strong_action_verb


def _extract_target_kelompok_name(query: str) -> str | None:
    text = (query or "").strip()
    if not text:
        return None

    patterns = [
        r"(?:kelompok|kelas|rombel)\s+([A-Za-z0-9][A-Za-z0-9 .-]{0,79})",
        r"\b([A-Za-z0-9][A-Za-z0-9 .-]{0,79})\s+(?:kelompok|kelas|rombel)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue

        candidate = _sanitize_person_name(match.group(1))
        candidate = re.split(r"\b(?:untuk|yang|di|ke|dari|agar|supaya)\b", candidate, maxsplit=1, flags=re.IGNORECASE)[0]
        candidate = re.sub(r"^(?:kelompok|kelas|rombel)\s+", "", candidate, flags=re.IGNORECASE)
        candidate = _sanitize_person_name(candidate)
        if candidate:
            return candidate

    return None


def _infer_latest_kelompok_from_recent_chat(supabase, room_id: str) -> str | None:
    if not room_id:
        return None

    try:
        rows = (
            supabase.table("chat_riwayat")
            .select("role_msg,content,timestamp")
            .eq("room_id", room_id)
            .order("timestamp", desc=True)
            .limit(16)
            .execute()
        ).data or []
    except Exception:
        return None

    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("role_msg") != "user":
            continue
        candidate = _extract_target_kelompok_name((row.get("content") or "").strip())
        if candidate:
            return candidate

    return None


def _format_student_list_by_kelompok(
    supabase,
    ra_id: str,
    tahun_ajaran_id: str,
    nama_kelompok_target: str,
) -> str:
    try:
        kelompok_rows = (
            supabase.table("kelompok_belajar")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .order("nama_kelompok")
            .execute()
        ).data or []
    except Exception as exc:
        return f"Gagal mengambil data kelompok: {exc}"

    if not kelompok_rows:
        return "Belum ada kelompok pada tahun ajaran aktif."

    kelompok_row, candidates = _resolve_kelompok_by_name(kelompok_rows, nama_kelompok_target)
    if not kelompok_row:
        pilihan = ", ".join(candidates) if candidates else ", ".join(
            [str(item.get("nama_kelompok") or "-") for item in kelompok_rows[:10] if isinstance(item, dict)]
        )
        return f"Kelompok '{nama_kelompok_target}' tidak ditemukan. Pilihan yang tersedia: {pilihan}."

    try:
        siswa_rows = (
            supabase.table("siswa")
            .select("nama")
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .eq("kelompok_id", kelompok_row.get("id"))
            .eq("status_aktif", True)
            .order("nama")
            .execute()
        ).data or []
    except Exception as exc:
        return f"Gagal mengambil data siswa kelompok: {exc}"

    names = [
        (item.get("nama") or "").strip()
        for item in siswa_rows
        if isinstance(item, dict) and (item.get("nama") or "").strip()
    ]
    if not names:
        return f"Belum ada siswa aktif pada {kelompok_row.get('nama_kelompok') or nama_kelompok_target}."

    lines = [f"- {name}" for name in names[:80]]
    return (
        f"Daftar siswa aktif {kelompok_row.get('nama_kelompok') or nama_kelompok_target} (total {len(names)}):\n"
        + "\n".join(lines)
    )


def _detect_admin_action_intent(query: str) -> str | None:
    normalized = _normalize_natural_language_query(query)
    if not normalized:
        return None

    if _looks_like_read_only_operational_query(normalized):
        return None

    transfer_student = (
        _contains_any(normalized, ["siswa", "peserta didik"])
        and _contains_any(normalized, ["pindah", "mutasi", "geser"])
        and _contains_any(normalized, ["kelompok", "kelas", "rombel"])
    )
    if transfer_student:
        return "transfer_student"

    create_student_from_add_verbs = (
        _contains_any(normalized, ["siswa", "peserta didik"])
        and _contains_any(normalized, ["tambah", "tambahkan", "daftarkan", "input", "masukkan", "registrasi"])
        and _contains_any(normalized, ["kelompok", "kelas", "rombel", "ke ", "di "])
    )
    create_student_from_buat_siswa_baru = (
        _contains_any(normalized, ["siswa baru", "murid baru", "peserta didik baru"])
        and _contains_any(normalized, ["buat", "buatkan"])
        and _contains_any(normalized, ["kelompok", "kelas", "rombel", "ke ", "di "])
    )
    create_student = create_student_from_add_verbs or create_student_from_buat_siswa_baru
    if create_student:
        return "create_student"

    attendance_action = (
        _contains_any(normalized, ["presensi", "kehadiran", "tidak hadir", "tidak masuk", "izin", "sakit", "alpha", "alfa", "alpa", "absen"])
        and _contains_any(normalized, ["catat", "tandai", "input", "set", "ubah", "update", "masukkan", "tolong", "mohon"])
    )
    if attendance_action:
        return "mark_attendance"

    attendance_statement = (
        bool(_extract_attendance_records_rule_based(normalized))
        and not _contains_any(normalized, ["siapa", "berapa", "rekap", "daftar", "list", "tampilkan"])
    )
    if attendance_statement:
        return "mark_attendance"

    return None


def _is_explicit_action_request(query: str) -> bool:
    normalized = _normalize_natural_language_query(query)
    return _contains_any(
        normalized,
        [
            "tolong",
            "mohon",
            "please",
            "bantu",
            "catat",
            "tandai",
            "set",
            "ubah",
            "update",
            "tambah",
            "tambahkan",
            "daftarkan",
            "input",
            "masukkan",
            "pindah",
            "mutasi",
            "geser",
        ],
    )


def _detect_admin_action_intent_with_llm(query: str) -> str | None:
    natural = _normalize_natural_language_query(query)
    if not natural:
        return None

    prompt = f"""Klasifikasikan intent perintah administrasi dari chat guru.

Konteks:
- Input bisa typo, bahasa campuran Indonesia/daerah, dan tidak baku.
- Prioritaskan aman: jangan menandai sebagai aksi jika masih ambigu.

Pilih hanya salah satu intent berikut:
- mark_attendance -> mencatat/mengubah kehadiran siswa
- create_student -> menambah/daftarkan siswa
- transfer_student -> pindah/mutasi siswa antar kelompok
- update_school_profile -> mengubah informasi profil sekolah/lembaga/RA (nama kepala, alamat, dll)
- update_gtk_info -> mengubah informasi profil profil guru/pegawai (nama, jabatan, telepon)
- manage_kelompok -> membuat atau mengubah data kelompok/rombel/kelas
- manage_academic_year -> mengubah atau memilih tahun ajaran aktif
- null -> bukan perintah aksi administrasi

Format output WAJIB JSON object:
{{
  "intent": "mark_attendance|create_student|transfer_student|update_school_profile|update_gtk_info|manage_kelompok|manage_academic_year|null",
  "is_action_request": true|false,
  "confidence": 0.0
}}

Pesan asli: {query}
Pesan dinormalisasi: {natural}
Output JSON saja:"""

    try:
        raw = generate_response(prompt)
    except Exception:
        return None

    parsed = _parse_json_object(raw) or {}
    if not isinstance(parsed, dict):
        return None

    intent = _normalize_text(str(parsed.get("intent") or ""))
    if intent in {"", "null", "none", "tidak ada"}:
        return None

    allowed_intents = {
        "mark_attendance", 
        "create_student", 
        "transfer_student", 
        "update_school_profile", 
        "update_gtk_info", 
        "manage_kelompok", 
        "manage_academic_year"
    }
    if intent not in allowed_intents:
        return None

    is_action_request = bool(parsed.get("is_action_request"))

    try:
        confidence = float(parsed.get("confidence") or 0)
    except (TypeError, ValueError):
        confidence = 0.0

    if not is_action_request or confidence < 0.7:
        return None

    return intent


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
    for query_variant in _iter_query_variants(query):
        rule_based_records = _extract_attendance_records_rule_based(query_variant)
        if rule_based_records:
            return rule_based_records

    natural = _normalize_natural_language_query(query)

    extraction_prompt = f"""Ekstrak data presensi dari pesan user menjadi JSON.

Aturan:
- Fokus hanya pada aksi pencatatan presensi/tidak hadir.
- Input bisa typo atau campuran bahasa Indonesia/daerah.
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

Pesan user (asli): {query}
Pesan user (dinormalisasi): {natural}
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
        if not status and _contains_any(f"{query} {natural}", ["tidak hadir", "tidak masuk", "absen"]):
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
    for query_variant in _iter_query_variants(query):
        rule_based_records = _extract_new_students_rule_based(query_variant)
        if rule_based_records:
            return rule_based_records

    natural = _normalize_natural_language_query(query)

    extraction_prompt = f"""Ekstrak data siswa baru dari pesan user menjadi JSON.

Aturan:
- Fokus hanya jika user meminta tambah/daftarkan siswa.
- Input bisa typo atau campuran bahasa Indonesia/daerah.
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

Pesan user (asli): {query}
Pesan user (dinormalisasi): {natural}
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


def _extract_transfer_students(query: str) -> list[dict]:
    for query_variant in _iter_query_variants(query):
        rule_based_records = _extract_transfer_students_rule_based(query_variant)
        if rule_based_records:
            return rule_based_records

    natural = _normalize_natural_language_query(query)

    extraction_prompt = f"""Ekstrak data pemindahan siswa antar kelompok dari pesan user menjadi JSON.

Aturan:
- Fokus hanya pada aksi pindah/mutasi siswa.
- Input bisa typo atau campuran bahasa Indonesia/daerah.
- Jangan mengarang nama siswa atau nama kelompok.
- Jika kelompok asal tidak disebut, isi null.

Format output WAJIB persis JSON object:
{{
  "records": [
    {{
      "nama_siswa": "...",
      "kelompok_tujuan": "...",
      "kelompok_asal": "...|null"
    }}
  ]
}}

Jika tidak ada data yang jelas, kembalikan: {{"records": []}}

Pesan user (asli): {query}
Pesan user (dinormalisasi): {natural}
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
        kelompok_tujuan = (item.get("kelompok_tujuan") or "").strip()
        if not nama_siswa:
            continue

        normalized_records.append(
            {
                "nama_siswa": nama_siswa,
                "kelompok_tujuan": kelompok_tujuan,
                "kelompok_asal": ((item.get("kelompok_asal") or "").strip() or None),
            }
        )

    return normalized_records


def _extract_school_profile_update(query: str) -> dict:
    natural = _normalize_natural_language_query(query)
    prompt = f"""Ekstrak perubahan data profil sekolah/RA dari pesan user menjadi JSON.

Aturan:
- Fokus pada: nama_kepala, npsn, alamat, telepon, email_lembaga, website.
- Isikan null untuk field yang tidak disebutkan perubahannya.
- Jangan mengarang data.

Format output WAJIB persis JSON object:
{{
  "nama_kepala": "...|null",
  "npsn": "...|null",
  "alamat": "...|null",
  "telepon": "...|null",
  "email_lembaga": "...|null",
  "website": "...|null"
}}

Pesan user: {query}
Pesan dinormalisasi: {natural}
Output JSON saja:"""

    try:
        raw = generate_response(prompt)
        parsed = _parse_json_object(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _extract_gtk_update(query: str) -> dict:
    natural = _normalize_natural_language_query(query)
    prompt = f"""Ekstrak pembaruan data Guru/Pegawai dari pesan user menjadi JSON.

Aturan Penting:
- HANYA ekstrak: nama (target), jabatan_baru, telepon_baru, nama_baru.
- 'target_name' adalah nama guru yang ingin diubah.
- Jika ada perubahan nama, isikan di 'nama_baru'.
- Isikan null jika tidak disebutkan.

Format output WAJIB:
{{
  "target_name": "...",
  "nama_baru": "...|null",
  "jabatan_baru": "...|null",
  "telepon_baru": "...|null"
}}

Pesan user: {query}
Output JSON saja:"""

    try:
        raw = generate_response(prompt)
        parsed = _parse_json_object(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _extract_kelompok_config(query: str) -> dict:
    natural = _normalize_natural_language_query(query)
    prompt = f"""Ekstrak pengaturan kelompok/rombel dari pesan user menjadi JSON.

Field:
- 'nama_kelompok': nama rombel yang dimaksud.
- 'kode_rombel': kode rombel (jika ada).
- 'tingkat': tingkat (A/B/dst).
- 'wali_kelas_nama': nama guru/wali kelas (jika disebut).

Format output WAJIB:
{{
  "nama_kelompok": "...",
  "kode_rombel": "...|null",
  "tingkat": "...|null",
  "wali_kelas_nama": "...|null"
}}

Pesan user: {query}
Output JSON saja:"""

    try:
        raw = generate_response(prompt)
        parsed = _parse_json_object(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}



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
            supabase.table("kelompok_belajar")
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


def _try_execute_transfer_student_action(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]
    tahun_ajaran_id = get_active_academic_year(supabase, ra_id, created_by=user_id)["id"]

    try:
        kelompok_rows = (
            supabase.table("kelompok_belajar")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .order("nama_kelompok")
            .execute()
        ).data or []
    except Exception as exc:
        return f"Gagal mengambil daftar kelompok: {exc}"

    if not kelompok_rows:
        return "Belum ada kelompok pada tahun ajaran aktif."

    records = _extract_transfer_students(query)
    if not records:
        return (
            "Saya siap memindahkan siswa, tapi datanya belum lengkap. "
            "Contoh: 'Pindahkan Budi dari Kelompok A ke Kelompok B'."
        )

    success_lines = []
    issue_lines = []
    available_kelompok = ", ".join([(item.get("nama_kelompok") or "-") for item in kelompok_rows[:10]])

    for record in records:
        nama_siswa = record.get("nama_siswa") or ""
        tujuan_name = record.get("kelompok_tujuan") or ""
        asal_name = record.get("kelompok_asal") or ""

        if not tujuan_name:
            issue_lines.append(f"- {nama_siswa}: kelompok tujuan belum disebut.")
            continue

        tujuan_row, tujuan_candidates = _resolve_kelompok_by_name(kelompok_rows, tujuan_name)
        if not tujuan_row:
            kandidat_text = ", ".join(tujuan_candidates) if tujuan_candidates else available_kelompok
            issue_lines.append(
                f"- {nama_siswa}: kelompok tujuan '{tujuan_name}' tidak ditemukan. Pilihan: {kandidat_text}."
            )
            continue

        asal_id = None
        if asal_name:
            asal_row, _ = _resolve_kelompok_by_name(kelompok_rows, asal_name)
            if not asal_row:
                issue_lines.append(f"- {nama_siswa}: kelompok asal '{asal_name}' tidak ditemukan.")
                continue
            asal_id = asal_row.get("id")

        try:
            siswa_row, error_kind, candidates = _resolve_student_for_action(
                supabase,
                ra_id,
                tahun_ajaran_id,
                nama_siswa,
                kelompok_id=asal_id,
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

        current_kelompok_id = siswa_row.get("kelompok_id")
        if isinstance(current_kelompok_id, str) and current_kelompok_id == tujuan_row.get("id"):
            issue_lines.append(
                f"- {nama_siswa}: sudah berada di {tujuan_row.get('nama_kelompok') or tujuan_name}."
            )
            continue

        try:
            supabase.table("siswa").update(
                {
                    "kelompok_id": tujuan_row.get("id"),
                    "tingkat_rombel": tujuan_row.get("nama_kelompok"),
                }
            ).eq("id", siswa_id).eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).execute()

            siswa_nama = siswa_row.get("nama") if isinstance(siswa_row.get("nama"), str) else nama_siswa
            success_lines.append(
                f"- {siswa_nama}: dipindahkan ke {tujuan_row.get('nama_kelompok') or tujuan_name}."
            )
        except Exception as exc:
            issue_lines.append(f"- {nama_siswa}: gagal memindahkan siswa ({exc}).")

    if success_lines and not issue_lines:
        return "Pemindahan siswa berhasil diproses:\n" + "\n".join(success_lines)

    if success_lines and issue_lines:
        return (
            f"Pemindahan siswa diproses sebagian. Berhasil: {len(success_lines)}, perlu perbaikan: {len(issue_lines)}.\n"
            + "\n".join(success_lines[:6])
            + "\n"
            + "\n".join(issue_lines[:6])
        )

    return "Belum ada siswa yang berhasil dipindahkan:\n" + "\n".join(issue_lines[:6])


def _try_execute_school_profile_action(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]
    update_data = _extract_school_profile_update(query)
    
    # Filter only non-null fields
    payload = {k: v for k, v in update_data.items() if v is not None}
    if not payload:
        return "Saya tidak menemukan informasi spesifik untuk diubah pada profil sekolah. Contoh: 'Alamat RA ganti ke Jl. Mawar'."

    try:
        supabase.table("sekolah").update(payload).eq("id", ra_id).execute()
        
        changes = ", ".join([f"{k.replace('_', ' ')}: {v}" for k, v in payload.items()])
        return f"Berhasil memperbarui profil sekolah: {changes}."
    except Exception as exc:
        return f"Gagal memperbarui profil sekolah: {exc}"


def _try_execute_gtk_info_action(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]
    update_data = _extract_gtk_update(query)
    
    target_name = update_data.get("target_name")
    if not target_name:
        return "Sebutkan nama guru yang ingin diubah datanya. Contoh: 'Update telepon Ibu Lilis ke 0812...'."

    try:
        # Search for the profile
        profile_resp = supabase.table("pengguna").select("id,nama").eq("ra_id", ra_id).ilike("nama", f"%{target_name}%").limit(5).execute()
        profiles = profile_resp.data or []
        
        if not profiles:
            return f"Data guru dengan nama '{target_name}' tidak ditemukan."
        if len(profiles) > 1:
            names = ", ".join([p["nama"] for p in profiles])
            return f"Ditemukan beberapa nama serupa: {names}. Mohon sebutkan nama lebih lengkap."
            
        profile_id = profiles[0]["id"]
        
        # Prepare payload - SECURITY: Limit fields
        payload = {}
        if update_data.get("nama_baru"): payload["nama"] = update_data["nama_baru"]
        if update_data.get("jabatan_baru"): payload["jabatan"] = update_data["jabatan_baru"]
        if update_data.get("telepon_baru"): payload["telepon"] = update_data["telepon_baru"]
        
        if not payload:
            return f"Saya menemukan data {profiles[0]['nama']}, tapi tidak ada instruksi perubahan yang valid (hanya Nama, Jabatan, Telepon yang diizinkan)."

        supabase.table("pengguna").update(payload).eq("id", profile_id).execute()
        changes = ", ".join([f"{k}: {v}" for k, v in payload.items()])
        return f"Berhasil memperbarui data {profiles[0]['nama']}: {changes}."
    except Exception as exc:
        return f"Gagal memperbarui data guru: {exc}"


def _try_execute_manage_kelompok_action(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]
    tahun_ajaran_id = get_active_academic_year(supabase, ra_id, created_by=user_id)["id"]
    
    config = _extract_kelompok_config(query)
    nama_kelompok = config.get("nama_kelompok")
    if not nama_kelompok:
        return "Sebutkan nama kelompok yang ingin dikelola. Contoh: 'Buat kelompok baru Kelompok C'."

    try:
        # Check if exists
        existing_resp = supabase.table("kelompok_belajar").select("id").eq("ra_id", ra_id).eq("tahun_ajaran_id", tahun_ajaran_id).ilike("nama_kelompok", f"%{nama_kelompok}%").limit(1).execute()
        existing = existing_resp.data[0] if existing_resp.data else None
        
        # Resolve wali kelas if provided
        wali_kelas_id = None
        wali_kelas_nama = config.get("wali_kelas_nama")
        if wali_kelas_nama:
            guru_resp = supabase.table("pengguna").select("id,nama").eq("ra_id", ra_id).ilike("nama", f"%{wali_kelas_nama}%").limit(5).execute()
            gurus = guru_resp.data or []
            if gurus:
                wali_kelas_id = gurus[0]["id"]

        payload = {
            "nama_kelompok": nama_kelompok,
            "ra_id": ra_id,
            "tahun_ajaran_id": tahun_ajaran_id,
        }
        if config.get("kode_rombel"): payload["kode_rombel"] = config["kode_rombel"]
        if config.get("tingkat"): payload["tingkat"] = config["tingkat"]
        if wali_kelas_id: payload["wali_kelas_id"] = wali_kelas_id

        if existing:
            supabase.table("kelompok_belajar").update(payload).eq("id", existing["id"]).execute()
            return f"Berhasil memperbarui data kelompok {nama_kelompok}."
        else:
            supabase.table("kelompok_belajar").insert(payload).execute()
            return f"Berhasil membuat kelompok baru: {nama_kelompok}."
            
    except Exception as exc:
        return f"Gagal mengelola data kelompok: {exc}"


def _extract_academic_year_config(query: str) -> dict:
    natural = _normalize_natural_language_query(query)
    prompt = f"""Ekstrak pemilihan/pengaturan tahun ajaran dari pesan user menjadi JSON.

Field:
- 'label': label tahun ajaran (format YYYY/YYYY, misal: 2026/2027).
- 'is_activate': true jika user meminta mengaktifkan/pindah ke tahun tersebut.

Format output WAJIB:
{{
  "label": "...|null",
  "is_activate": true|false
}}

Pesan user: {query}
Output JSON saja:"""

    try:
        raw = generate_response(prompt)
        parsed = _parse_json_object(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _try_execute_academic_year_action(supabase, current: dict, query: str) -> str:
    ra_id = current["ra_id"]
    config = _extract_academic_year_config(query)
    label = config.get("label")
    
    if not label:
        return "Sebutkan tahun ajaran yang dimaksud. Contoh: 'Aktifkan tahun ajaran 2026/2027'."

    try:
        normalized_label = normalize_academic_year_label(label)
    except Exception:
        return f"Format tahun ajaran '{label}' tidak valid. Gunakan format YYYY/YYYY, contoh: 2026/2027."

    try:
        # Search for year with this label
        response = (
            supabase.table("tahun_ajaran")
            .select("id,label,is_active")
            .eq("ra_id", ra_id)
            .eq("label", normalized_label)
            .limit(1)
            .execute()
        )
        year_row = response.data[0] if response.data else None
        
        if not year_row:
            return f"Tahun ajaran {normalized_label} belum terdaftar di sistem. Silakan buat dahulu melalui menu manajemen tahun ajaran."

        if config.get("is_activate"):
            if year_row.get("is_active"):
                return f"Tahun ajaran {normalized_label} sudah aktif."
            
            from app.utils.academic_year import activate_academic_year
            activate_academic_year(supabase, ra_id, year_row["id"])
            return f"Berhasil mengaktifkan tahun ajaran {normalized_label}."
            
        return f"Saya menemukan data tahun ajaran {normalized_label}, tetapi tidak ada perintah spesifik (seperti 'aktifkan')."
        
    except Exception as exc:
        return f"Gagal mengelola tahun ajaran: {exc}"


def _try_execute_admin_action(supabase, current: dict, query: str) -> str | None:
    if _looks_like_read_only_operational_query(query):
        return None

    intent = _detect_admin_action_intent(query)
    if not intent and _is_explicit_action_request(query):
        for query_variant in _iter_query_variants(query):
            if _extract_transfer_students_rule_based(query_variant):
                intent = "transfer_student"
                break
            if _extract_new_students_rule_based(query_variant):
                intent = "create_student"
                break
            if _extract_attendance_records_rule_based(query_variant):
                intent = "mark_attendance"
                break

    if not intent:
        intent = _detect_admin_action_intent_with_llm(query)

    if not intent:
        return None

    if intent == "mark_attendance":
        return _try_execute_attendance_action(supabase, current, query)

    if intent == "create_student":
        return _try_execute_create_student_action(supabase, current, query)

    if intent == "transfer_student":
        return _try_execute_transfer_student_action(supabase, current, query)

    if intent == "update_school_profile":
        return _try_execute_school_profile_action(supabase, current, query)

    if intent == "update_gtk_info":
        return _try_execute_gtk_info_action(supabase, current, query)

    if intent == "manage_kelompok":
        return _try_execute_manage_kelompok_action(supabase, current, query)

    if intent == "manage_academic_year":
        return _try_execute_academic_year_action(supabase, current, query)

    return None


def _classify_chat_route(query: str) -> str:
    steps = _split_multi_step_commands(query)
    if len(steps) > 1:
        return "multi_step"

    if _detect_admin_action_intent(query):
        return "admin_action"

    if _is_explicit_action_request(query):
        for query_variant in _iter_query_variants(query):
            if _extract_transfer_students_rule_based(query_variant):
                return "admin_action"
            if _extract_new_students_rule_based(query_variant):
                return "admin_action"
            if _extract_attendance_records_rule_based(query_variant):
                return "admin_action"

    if _looks_like_read_only_operational_query(query):
        return "operational_query"

    normalized = _normalize_natural_language_query(query)
    if _contains_any(
        normalized,
        [
            "tanggal",
            "jam",
            "kepala",
            "nama ra",
            "profil",
            "tahun ajaran",
            "kalender",
            "guru",
            "pengguna",
            "siswa",
            "kelompok",
            "presensi",
            "surat",
            "template",
            "knowledge",
            "notifikasi",
            "chat room",
        ],
    ):
        return "operational_query"

    return "ai_fallback"


def _execute_single_workflow_step(
    supabase,
    current: dict,
    step_query: str,
    room_id: str | None,
) -> tuple[str, str]:
    action_result = _try_execute_admin_action(supabase, current, step_query)
    if action_result:
        return "aksi", action_result

    operational_result = _build_operational_query_response(
        supabase,
        current,
        step_query,
        room_id=room_id,
    )
    if operational_result:
        return "operasional", operational_result

    ai_result = _build_grounded_ai_response(supabase, current, step_query, room_id=room_id)
    return "ai", ai_result


def _try_execute_multi_step_workflow(
    supabase,
    current: dict,
    query: str,
    room_id: str | None,
) -> str | None:
    steps = _split_multi_step_commands(query)
    if len(steps) < 2:
        return None

    results = []
    previous_step_output = ""
    label_map = {
        "aksi": "Aksi Data",
        "operasional": "Query Data",
        "ai": "Penjelasan",
    }

    for idx, step in enumerate(steps, start=1):
        step_input = step
        if previous_step_output and _is_followup_step_command(step):
            step_input = (
                f"{step}\n\n"
                "Konteks hasil langkah sebelumnya:\n"
                f"{previous_step_output[:1200]}"
            )

        try:
            step_kind, step_output = _execute_single_workflow_step(
                supabase,
                current,
                step_input,
                room_id=room_id,
            )
        except Exception as exc:
            results.append(f"Langkah {idx} (Error): Gagal diproses ({exc}).")
            continue

        if not step_output:
            results.append(f"Langkah {idx} ({label_map.get(step_kind, 'Proses')}): Tidak ada hasil.")
            continue

        previous_step_output = step_output
        results.append(
            f"Langkah {idx} ({label_map.get(step_kind, 'Proses')}):\n{step_output.strip()}"
        )

    if not results:
        return None

    return "Workflow multi-langkah selesai diproses:\n\n" + "\n\n".join(results)


def _build_operational_query_response(supabase, current: dict, query: str, room_id: str | None = None) -> str | None:
    normalized = _normalize_natural_language_query(query)
    if not normalized:
        return None

    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    tahun_ajaran_id: str | None = None
    _CACHE_EMPTY = object()
    ra_profile_row = _CACHE_EMPTY
    active_year_row = _CACHE_EMPTY
    profiles_rows = _CACHE_EMPTY
    kelompok_cache: dict[str, list[dict]] = {}

    def _format_date_id(value) -> str:
        if value is None:
            return "-"

        raw = str(value).strip()
        if not raw:
            return "-"

        iso_candidate = raw[:10]
        try:
            dt = datetime.strptime(iso_candidate, "%Y-%m-%d")
        except ValueError:
            return raw

        bulan_map = {
            1: "Januari",
            2: "Februari",
            3: "Maret",
            4: "April",
            5: "Mei",
            6: "Juni",
            7: "Juli",
            8: "Agustus",
            9: "September",
            10: "Oktober",
            11: "November",
            12: "Desember",
        }
        return f"{dt.day} {bulan_map.get(dt.month, '-')} {dt.year}"

    def _get_ra_profile() -> dict:
        nonlocal ra_profile_row
        if ra_profile_row is not _CACHE_EMPTY:
            return ra_profile_row if isinstance(ra_profile_row, dict) else {}

        try:
            response = (
                supabase.table("sekolah")
                .select(
                    "id,nama_ra,nama_kepala,alamat,telepon,email_lembaga,website,"
                    "npsn,akreditasi,status_lembaga,bentuk_pendidikan,penyelenggara,"
                    "kelurahan_desa,kecamatan,kabupaten_kota,provinsi,tahun_ajaran"
                )
                .eq("id", ra_id)
                .limit(1)
                .execute()
            )
            ra_profile_row = response.data[0] if response.data else {}
        except Exception:
            ra_profile_row = {}

        return ra_profile_row if isinstance(ra_profile_row, dict) else {}

    def _get_profiles() -> list[dict]:
        nonlocal profiles_rows
        if profiles_rows is not _CACHE_EMPTY:
            return profiles_rows if isinstance(profiles_rows, list) else []

        try:
            response = (
                supabase.table("pengguna")
                .select("id,nama,role,jabatan,email,telepon")
                .eq("ra_id", ra_id)
                .order("nama")
                .limit(300)
                .execute()
            )
            profiles_rows = [item for item in (response.data or []) if isinstance(item, dict)]
        except Exception:
            profiles_rows = []

        return profiles_rows if isinstance(profiles_rows, list) else []

    def _get_active_year_row() -> dict:
        nonlocal active_year_row
        if active_year_row is not _CACHE_EMPTY:
            return active_year_row if isinstance(active_year_row, dict) else {}

        try:
            response = (
                supabase.table("tahun_ajaran")
                .select("id,label,is_active,hari_efektif_belajar")
                .eq("ra_id", ra_id)
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            active_year_row = response.data[0] if response.data else {}
        except Exception:
            active_year_row = {}

        return active_year_row if isinstance(active_year_row, dict) else {}

    def _get_kelompok_rows(active_year_id: str) -> list[dict]:
        if active_year_id in kelompok_cache:
            return kelompok_cache[active_year_id]

        try:
            response = (
                supabase.table("kelompok_belajar")
                .select(
                    "id,nama_kelompok,wali_kelas_id,kode_rombel,tingkat,"
                    "semester,kurikulum,ruang_kelas,kapasitas,status_rombel"
                )
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .order("nama_kelompok")
                .execute()
            )
            kelompok_cache[active_year_id] = [item for item in (response.data or []) if isinstance(item, dict)]
        except Exception:
            kelompok_cache[active_year_id] = []

        return kelompok_cache[active_year_id]

    def _get_tahun_ajaran_id() -> str:
        nonlocal tahun_ajaran_id
        if not tahun_ajaran_id:
            active_row = _get_active_year_row()
            active_id = active_row.get("id") if isinstance(active_row, dict) else None
            if isinstance(active_id, str) and active_id:
                tahun_ajaran_id = active_id
            else:
                tahun_ajaran_id = get_active_academic_year(supabase, ra_id, created_by=user_id)["id"]
        return tahun_ajaran_id

    source_data_query = _contains_any(
        normalized,
        ["dari mana data", "sumber data", "data dari mana", "ambil dari mana", "baca data", "membaca data"],
    )
    if source_data_query:
        if _contains_any(normalized, ["kepala", "nama ra", "sekolah", "profil"]):
            return (
                "Untuk pertanyaan profil sekolah/kepala RA, saya membaca data internal aplikasi dari profil RA "
                "dan data pengguna pada RA yang sama."
            )
        if _contains_any(normalized, ["siswa", "kelompok", "presensi"]):
            return (
                "Untuk pertanyaan siswa, kelompok, dan presensi, saya membaca langsung data operasional "
                "tahun ajaran aktif di sistem."
            )
        return (
            "Saya menggunakan data internal aplikasi sesuai modul yang ditanyakan "
            "(profil RA, pengguna, kelompok, siswa, presensi, surat, notifikasi, knowledge, dan tahun ajaran)."
        )

    tanggal_query = _contains_any(
        normalized,
        ["tanggal berapa", "hari apa", "tanggal hari ini", "sekarang tanggal", "tanggal sekarang", "hari ini tanggal"],
    )
    if tanggal_query:
        now_local = datetime.now()
        hari_map = {
            0: "Senin",
            1: "Selasa",
            2: "Rabu",
            3: "Kamis",
            4: "Jumat",
            5: "Sabtu",
            6: "Minggu",
        }
        bulan_map = {
            1: "Januari",
            2: "Februari",
            3: "Maret",
            4: "April",
            5: "Mei",
            6: "Juni",
            7: "Juli",
            8: "Agustus",
            9: "September",
            10: "Oktober",
            11: "November",
            12: "Desember",
        }
        hari = hari_map.get(now_local.weekday(), "-")
        bulan = bulan_map.get(now_local.month, "-")
        return f"Sekarang hari {hari}, tanggal {now_local.day} {bulan} {now_local.year}."

    waktu_query = _contains_any(normalized, ["jam berapa", "waktu sekarang", "sekarang jam"]) and not tanggal_query
    if waktu_query:
        now_local = datetime.now()
        return f"Sekarang pukul {now_local.strftime('%H:%M')} waktu server aplikasi."

    nama_ra_query = _contains_any(
        normalized,
        [
            "nama ra",
            "nama sekolah",
            "nama madrasah",
            "sekolah ini",
            "lembaga ini",
            "nama lembaga",
        ],
    )
    if nama_ra_query:
        ra_profile = _get_ra_profile()
        nama_ra = (ra_profile.get("nama_ra") or "").strip()
        if nama_ra:
            return f"Nama sekolah/RA yang tercatat saat ini adalah {nama_ra}."
        return "Nama sekolah/RA belum diatur di profil RA."

    konfirmasi_nama_ra_query = _contains_any(
        normalized,
        ["bukannya", "setahu saya", "apakah", "benar", "betul"],
    ) and _contains_any(normalized, ["ra", "sekolah", "madrasah"])
    if konfirmasi_nama_ra_query:
        ra_profile = _get_ra_profile()
        nama_ra = (ra_profile.get("nama_ra") or "").strip()
        if nama_ra:
            match = re.search(r"(?:ra|sekolah|madrasah)\s+([A-Za-z][A-Za-z0-9 .'-]{1,80})", query, flags=re.IGNORECASE)
            if match:
                candidate = _sanitize_person_name(match.group(1))
                actual_norm = re.sub(r"^(?:ra|sekolah|madrasah)\s+", "", _normalize_text(nama_ra))
                candidate_norm = re.sub(r"^(?:ra|sekolah|madrasah)\s+", "", _normalize_text(candidate))
                if candidate_norm and (candidate_norm == actual_norm or candidate_norm in actual_norm):
                    return f"Benar, di data saat ini nama sekolah tercatat {nama_ra}."
                return f"Di data saat ini, nama sekolah tercatat {nama_ra}."

    wali_kelas_query = _contains_any(normalized, ["wali kelas", "wali kelompok", "guru kelas", "siapa wali"])
    if wali_kelas_query:
        nama_kelompok_target = _extract_target_kelompok_name(query)
        if not nama_kelompok_target:
            return "Sebutkan kelompoknya. Contoh: 'Siapa wali kelas Kelompok A?'."

        try:
            active_year_id = _get_tahun_ajaran_id()
            kelompok_rows = _get_kelompok_rows(active_year_id)
        except Exception as exc:
            return f"Gagal mengambil data wali kelas: {exc}"

        kelompok_row, candidates = _resolve_kelompok_by_name(kelompok_rows, nama_kelompok_target)
        if not kelompok_row:
            pilihan = ", ".join(candidates) if candidates else ", ".join(
                [str(item.get("nama_kelompok") or "-") for item in kelompok_rows[:10] if isinstance(item, dict)]
            )
            return f"Kelompok '{nama_kelompok_target}' tidak ditemukan. Pilihan yang tersedia: {pilihan}."

        wali_kelas_id = kelompok_row.get("wali_kelas_id") if isinstance(kelompok_row, dict) else None
        kelompok_label = kelompok_row.get("nama_kelompok") or nama_kelompok_target
        if not wali_kelas_id:
            return f"Wali kelas untuk {kelompok_label} belum diatur di sistem."

        profile_map = {item.get("id"): item for item in _get_profiles() if item.get("id")}
        profile_row = profile_map.get(wali_kelas_id)
        if not isinstance(profile_row, dict):
            return f"Wali kelas untuk {kelompok_label} sudah ditetapkan, tetapi profil gurunya tidak ditemukan."

        nama_wali = (profile_row.get("nama") or "-")
        return f"Wali kelas {kelompok_label} adalah {nama_wali}."

    kepala_ra_query = _contains_any(
        normalized,
        [
            "siapa kepala",
            "nama kepala",
            "kepala ra",
            "kepala sekolah",
            "kepala madrasah",
            "kamad",
            "kepsek",
        ],
    )
    if kepala_ra_query:
        ra_profile = _get_ra_profile()
        nama_kepala = (ra_profile.get("nama_kepala") or "").strip()
        if nama_kepala:
            return f"Kepala RA yang tercatat saat ini adalah {nama_kepala}."

        admins = [
            item
            for item in _get_profiles()
            if _normalize_text(item.get("role") or "") in {"kepala_ra", "kepala", "admin_ra", "admin"}
        ]
        if not admins:
            return "Data kepala RA belum diatur di sistem."

        if len(admins) == 1:
            return f"Profil dengan peran kepala/admin yang tercatat saat ini adalah {admins[0].get('nama') or '-'}."

        names = [item.get("nama") or "-" for item in admins[:6]]
        return "Ada beberapa profil kepala/admin yang tercatat: " + ", ".join(names) + "."

    profil_ra_query = _contains_any(
        normalized,
        [
            "profil ra",
            "profil sekolah",
            "informasi sekolah",
            "data sekolah",
            "alamat sekolah",
            "kontak sekolah",
            "npsn",
            "akreditasi",
            "website",
        ],
    )
    if profil_ra_query:
        ra_profile = _get_ra_profile()
        if not ra_profile:
            return "Profil RA belum tersedia di sistem."

        nama_ra = ra_profile.get("nama_ra") or "-"
        nama_kepala = ra_profile.get("nama_kepala") or "-"
        alamat_parts = [
            ra_profile.get("alamat") or "",
            ra_profile.get("kelurahan_desa") or "",
            ra_profile.get("kecamatan") or "",
            ra_profile.get("kabupaten_kota") or "",
            ra_profile.get("provinsi") or "",
        ]
        alamat_full = ", ".join([part for part in alamat_parts if str(part).strip()]) or "-"
        return (
            f"Profil RA: {nama_ra}. Kepala: {nama_kepala}. "
            f"NPSN: {ra_profile.get('npsn') or '-'}. Akreditasi: {ra_profile.get('akreditasi') or '-'}. "
            f"Alamat: {alamat_full}. Telepon: {ra_profile.get('telepon') or '-'}. "
            f"Email: {ra_profile.get('email_lembaga') or '-'}. Website: {ra_profile.get('website') or '-'}"
        )

    profile_saya_query = _contains_any(normalized, ["siapa saya", "profil saya", "jabatan saya", "role saya", "akun saya"])
    if profile_saya_query:
        my_profile = current.get("profile") or {}
        nama = my_profile.get("nama") or "-"
        role = (my_profile.get("role") or "-").lower()
        email = my_profile.get("email") or "-"
        return f"Profil Anda: nama {nama}, role {role}, email {email}."

    tahun_ajaran_query = _contains_any(
        normalized,
        [
            "tahun ajaran aktif",
            "tahun ajaran sekarang",
            "tahun ajaran berjalan",
            "ta aktif",
            "ta sekarang",
            "hari efektif belajar",
        ],
    )
    if tahun_ajaran_query:
        active_row = _get_active_year_row()
        if not active_row:
            try:
                active_row = get_active_academic_year(supabase, ra_id, created_by=user_id)
            except Exception as exc:
                return f"Gagal mengambil tahun ajaran aktif: {exc}"

        label = active_row.get("label") or "-"
        hari_efektif = active_row.get("hari_efektif_belajar")
        if hari_efektif in {5, 6}:
            return f"Tahun ajaran aktif saat ini: {label} (hari efektif belajar {hari_efektif} hari per minggu)."
        return f"Tahun ajaran aktif saat ini: {label}."

    kalender_query = _contains_any(
        normalized,
        [
            "kalender pendidikan",
            "event akademik",
            "jadwal libur",
            "hari libur",
            "tanggal merah",
            "libur",
        ],
    )
    if kalender_query:
        try:
            active_year_id = _get_tahun_ajaran_id()
        except Exception as exc:
            return f"Gagal menentukan tahun ajaran aktif: {exc}"

        today = date.today().isoformat()
        try:
            cal_query = (
                supabase.table("kalender_pendidikan")
                .select("tanggal,nama_event,is_holiday,sumber")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .order("tanggal")
            )
            if _contains_any(normalized, ["hari ini", "tanggal ini"]):
                cal_rows = cal_query.eq("tanggal", today).limit(20).execute().data or []
            else:
                cal_rows = cal_query.gte("tanggal", today).limit(12).execute().data or []
        except Exception as exc:
            return f"Gagal mengambil kalender pendidikan: {exc}"

        if not cal_rows:
            return "Belum ada data kalender pendidikan pada tahun ajaran aktif."

        lines = []
        for item in cal_rows[:10]:
            if not isinstance(item, dict):
                continue
            label = "libur" if item.get("is_holiday") else "kegiatan"
            lines.append(
                f"- {_format_date_id(item.get('tanggal'))}: {item.get('nama_event') or '-'} ({label}, sumber {item.get('sumber') or '-'})"
            )
        return "Kalender pendidikan:\n" + "\n".join(lines)

    guru_query = _contains_any(
        normalized,
        ["daftar guru", "list guru", "data guru", "jumlah guru", "berapa guru", "gtk", "pengajar"],
    )
    if guru_query:
        rows = _get_profiles()
        guru_rows = [
            item
            for item in rows
            if _normalize_text(item.get("role") or "") in {"guru", "guru_ra"}
            or "guru" in _normalize_text(item.get("jabatan") or "")
        ]

        if not guru_rows:
            return "Belum ada data guru pada RA ini."

        request_count_only = _contains_any(normalized, ["jumlah", "berapa", "total"]) and not _contains_any(
            normalized, ["siapa", "nama", "daftar", "list"]
        )
        if request_count_only:
            return f"Jumlah guru yang tercatat saat ini: {len(guru_rows)} orang."

        lines = [f"- {item.get('nama') or '-'}" for item in guru_rows[:25]]
        return f"Daftar guru (total {len(guru_rows)}):\n" + "\n".join(lines)

    pengguna_query = _contains_any(normalized, ["daftar pengguna", "data pengguna", "list user", "jumlah pengguna", "akun pengguna"])
    if pengguna_query:
        rows = _get_profiles()
        if not rows:
            return "Belum ada data pengguna pada RA ini."

        request_count_only = _contains_any(normalized, ["jumlah", "berapa", "total"]) and not _contains_any(
            normalized, ["siapa", "nama", "daftar", "list"]
        )
        if request_count_only:
            return f"Jumlah pengguna yang tercatat saat ini: {len(rows)} akun."

        lines = [
            f"- {item.get('nama') or '-'} ({(_normalize_text(item.get('role') or '-') or '-')})"
            for item in rows[:30]
        ]
        return f"Daftar pengguna (total {len(rows)}):\n" + "\n".join(lines)

    presensi_belum_list_query = _contains_any(
        normalized,
        ["siapa yang belum", "daftar belum", "siapa belum", "belum dicatat", "belum presensi"],
    ) and _contains_any(normalized, ["presensi", "kehadiran", "absen"]) 
    if presensi_belum_list_query:
        today = date.today().isoformat()
        try:
            active_year_id = _get_tahun_ajaran_id()
            kelompok_rows = _get_kelompok_rows(active_year_id)

            siswa_query = (
                supabase.table("siswa")
                .select("id,nama,kelompok_id")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .eq("status_aktif", True)
            )

            target_name = _extract_target_kelompok_name(query)
            if target_name:
                kelompok_row, _ = _resolve_kelompok_by_name(kelompok_rows, target_name)
                if not kelompok_row:
                    return f"Kelompok '{target_name}' tidak ditemukan untuk pengecekan presensi."
                siswa_query = siswa_query.eq("kelompok_id", kelompok_row.get("id"))

            siswa_rows = siswa_query.order("nama").execute().data or []
            siswa_rows = [item for item in siswa_rows if isinstance(item, dict) and item.get("id")]
            if not siswa_rows:
                return "Tidak ada siswa aktif yang bisa dicek presensinya."

            siswa_ids = [item.get("id") for item in siswa_rows if item.get("id")]
            presensi_rows = (
                supabase.table("presensi")
                .select("siswa_id")
                .eq("tanggal", today)
                .eq("tahun_ajaran_id", active_year_id)
                .in_("siswa_id", siswa_ids)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil daftar presensi belum tercatat: {exc}"

        recorded = {
            row.get("siswa_id")
            for row in presensi_rows
            if isinstance(row, dict) and row.get("siswa_id")
        }
        pending_names = [item.get("nama") or "-" for item in siswa_rows if item.get("id") not in recorded]

        if not pending_names:
            return "Semua siswa aktif sudah memiliki catatan presensi hari ini."

        lines = [f"- {name}" for name in pending_names[:50]]
        return (
            f"Siswa yang belum dicatat presensinya hari ini (total {len(pending_names)}):\n"
            + "\n".join(lines)
        )

    presensi_rekap_query = _contains_any(
        normalized,
        ["rekap absensi", "rekap presensi", "daftar hadir", "ringkasan hadir", "rekapitulasi"],
    ) and _contains_any(normalized, ["presensi", "kehadiran", "absen", "hari ini"])
    if presensi_rekap_query:
        today = date.today().isoformat()
        try:
            active_year_id = _get_tahun_ajaran_id()
            kelompok_rows = _get_kelompok_rows(active_year_id)
            
            target_name = _extract_target_kelompok_name(query)
            target_kelompok = None
            if target_name:
                target_kelompok, _ = _resolve_kelompok_by_name(kelompok_rows, target_name)
            
            siswa_query = (
                supabase.table("siswa")
                .select("id,nama,kelompok_id")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .eq("status_aktif", True)
            )
            if target_kelompok:
                siswa_query = siswa_query.eq("kelompok_id", target_kelompok["id"])
            
            siswa_list = siswa_query.execute().data or []
            siswa_map = {s["id"]: s["nama"] for s in siswa_list if s.get("id")}
            siswa_ids = list(siswa_map.keys())
            
            if not siswa_ids:
                return f"Tidak ada data siswa aktif untuk {target_name or 'semua kelompok'}."

            presensi_rows = (
                supabase.table("presensi")
                .select("siswa_id,status")
                .eq("tanggal", today)
                .eq("tahun_ajaran_id", active_year_id)
                .in_("siswa_id", siswa_ids)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil rekap presensi: {exc}"

        stats = {"hadir": [], "sakit": [], "izin": [], "alpha": []}
        recorded_ids = set()
        for p in presensi_rows:
            sid = p.get("siswa_id")
            status = p.get("status")
            if sid in siswa_map and status in stats:
                stats[status].append(siswa_map[sid])
                recorded_ids.add(sid)
        
        not_recorded = [name for sid, name in siswa_map.items() if sid not in recorded_ids]
        
        label = f"Kelompok {target_kelompok['nama_kelompok']}" if target_kelompok else "Semua Kelompok"
        res = f"Rekapitulasi Presensi {label} ({_format_date_id(today)}):\n"
        res += f"✅ Hadir: {len(stats['hadir'])} siswa\n"
        res += f"🤒 Sakit: {', '.join(stats['sakit']) if stats['sakit'] else '-'}\n"
        res += f"✉️ Izin: {', '.join(stats['izin']) if stats['izin'] else '-'}\n"
        res += f"❌ Alpha: {', '.join(stats['alpha']) if stats['alpha'] else '-'}\n"
        if not_recorded:
            res += f"⏳ Belum dicatat: {len(not_recorded)} siswa"
            if len(not_recorded) <= 5:
                res += f" ({', '.join(not_recorded)})"
        
        return res

    presensi_query = _contains_any(
        normalized,
        ["rekap presensi", "presensi hari ini", "berapa yang hadir", "belum dicatat", "kehadiran hari ini"],
    )
    if presensi_query:
        today = date.today().isoformat()
        try:
            active_year_id = _get_tahun_ajaran_id()
            siswa_rows = (
                supabase.table("siswa")
                .select("id")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .eq("status_aktif", True)
                .execute()
            ).data or []
            siswa_ids = [item.get("id") for item in siswa_rows if isinstance(item, dict) and item.get("id")]

            if not siswa_ids:
                return "Belum ada siswa aktif pada tahun ajaran berjalan."

            presensi_rows = (
                supabase.table("presensi")
                .select("status")
                .eq("tanggal", today)
                .eq("tahun_ajaran_id", active_year_id)
                .in_("siswa_id", siswa_ids)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil rekap presensi: {exc}"

        hadir = sum(1 for row in presensi_rows if isinstance(row, dict) and row.get("status") == "hadir")
        sakit = sum(1 for row in presensi_rows if isinstance(row, dict) and row.get("status") == "sakit")
        izin = sum(1 for row in presensi_rows if isinstance(row, dict) and row.get("status") == "izin")
        alpha = sum(1 for row in presensi_rows if isinstance(row, dict) and row.get("status") == "alpha")
        belum = max(len(siswa_ids) - len(presensi_rows), 0)

        return (
            f"Rekap presensi {today}: dari {len(siswa_ids)} siswa aktif, "
            f"hadir {hadir}, sakit {sakit}, izin {izin}, alpha {alpha}, belum dicatat {belum}."
        )

    siswa_kelompok_query = _contains_any(
        normalized,
        ["jumlah siswa per kelompok", "siswa per kelompok", "berapa siswa di kelompok", "rekap siswa kelompok"],
    )
    if siswa_kelompok_query:
        try:
            active_year_id = _get_tahun_ajaran_id()
            kelompok_rows = (
                supabase.table("kelompok_belajar")
                .select("id,nama_kelompok")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .order("nama_kelompok")
                .execute()
            ).data or []
            siswa_rows = (
                supabase.table("siswa")
                .select("kelompok_id")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .eq("status_aktif", True)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil data siswa per kelompok: {exc}"

        if not kelompok_rows:
            return "Belum ada kelompok pada tahun ajaran aktif."

        counts: dict[str, int] = {}
        for row in siswa_rows:
            if isinstance(row, dict):
                key = row.get("kelompok_id")
                if isinstance(key, str) and key:
                    counts[key] = counts.get(key, 0) + 1

        lines = []
        total = 0
        for kelompok in kelompok_rows:
            if not isinstance(kelompok, dict):
                continue
            kelompok_id = kelompok.get("id")
            if not isinstance(kelompok_id, str):
                continue
            jumlah = counts.get(kelompok_id, 0)
            total += jumlah
            lines.append(f"- {kelompok.get('nama_kelompok') or '-'}: {jumlah} siswa")

        if not lines:
            return "Belum ada data kelompok untuk ditampilkan."

        return "Jumlah siswa aktif per kelompok:\n" + "\n".join(lines[:12]) + f"\nTotal siswa aktif: {total}."

    total_siswa_query = _contains_any(
        normalized,
        ["jumlah siswa", "total siswa", "berapa siswa", "siswa aktif"],
    ) and not _contains_any(normalized, ["per kelompok", "kelompok", "kelas", "rombel"])
    if total_siswa_query:
        try:
            active_year_id = _get_tahun_ajaran_id()
            siswa_rows = (
                supabase.table("siswa")
                .select("id")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .eq("status_aktif", True)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil jumlah siswa: {exc}"

        total = len([row for row in siswa_rows if isinstance(row, dict)])
        return f"Total siswa aktif pada tahun ajaran berjalan: {total} siswa."

    daftar_kelompok_query = _contains_any(
        normalized,
        ["daftar kelompok", "list kelompok", "kelompok apa saja", "kelas apa saja", "rombel apa saja"],
    )
    if daftar_kelompok_query:
        try:
            active_year_id = _get_tahun_ajaran_id()
            kelompok_rows = _get_kelompok_rows(active_year_id)
        except Exception as exc:
            return f"Gagal mengambil daftar kelompok: {exc}"

        valid_rows = [item for item in kelompok_rows if isinstance(item, dict) and item.get("nama_kelompok")]
        if not valid_rows:
            return "Belum ada kelompok pada tahun ajaran aktif."

        profile_map = {item.get("id"): item for item in _get_profiles() if item.get("id")}
        lines = []
        for item in valid_rows[:20]:
            wali_id = item.get("wali_kelas_id")
            wali_name = "-"
            if isinstance(wali_id, str) and wali_id and isinstance(profile_map.get(wali_id), dict):
                wali_name = profile_map[wali_id].get("nama") or "-"
            lines.append(f"- {item.get('nama_kelompok') or '-'} (wali: {wali_name})")

        return "Kelompok yang tersedia:\n" + "\n".join(lines)

    detail_kelompok_query = _contains_any(
        normalized,
        ["detail kelompok", "data kelompok", "info kelompok"],
    ) and _contains_any(normalized, ["kelompok", "kelas", "rombel"]) and not _contains_any(
        normalized, ["daftar siswa", "list siswa", "nama siswa", "rekap siswa"]
    )
    if detail_kelompok_query:
        target_name = _extract_target_kelompok_name(query)
        if not target_name:
            return "Sebutkan nama kelompoknya. Contoh: 'Detail kelompok A'."

        try:
            active_year_id = _get_tahun_ajaran_id()
            kelompok_rows = _get_kelompok_rows(active_year_id)
        except Exception as exc:
            return f"Gagal mengambil data kelompok: {exc}"

        kelompok_row, candidates = _resolve_kelompok_by_name(kelompok_rows, target_name)
        if not kelompok_row:
            pilihan = ", ".join(candidates) if candidates else ", ".join(
                [str(item.get("nama_kelompok") or "-") for item in kelompok_rows[:10] if isinstance(item, dict)]
            )
            return f"Kelompok '{target_name}' tidak ditemukan. Pilihan yang tersedia: {pilihan}."

        try:
            siswa_rows = (
                supabase.table("siswa")
                .select("id")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .eq("status_aktif", True)
                .eq("kelompok_id", kelompok_row.get("id"))
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal menghitung siswa kelompok: {exc}"

        profile_map = {item.get("id"): item for item in _get_profiles() if item.get("id")}
        wali_name = "-"
        wali_id = kelompok_row.get("wali_kelas_id")
        if isinstance(wali_id, str) and wali_id and isinstance(profile_map.get(wali_id), dict):
            wali_name = profile_map[wali_id].get("nama") or "-"

        total_siswa = len([item for item in siswa_rows if isinstance(item, dict)])
        return (
            f"Detail {kelompok_row.get('nama_kelompok') or target_name}: wali kelas {wali_name}, "
            f"jumlah siswa aktif {total_siswa}, kode rombel {kelompok_row.get('kode_rombel') or '-'}, "
            f"tingkat {kelompok_row.get('tingkat') or '-'}, status rombel {kelompok_row.get('status_rombel') or '-'}"
        )

    daftar_siswa_kelompok_query = (
        _contains_any(normalized, ["daftar siswa", "list siswa", "data siswa", "nama siswa", "rekap siswa", "semua siswa", "nama"]) 
        and _contains_any(normalized, ["kelompok", "kelas", "rombel"])
    )
    if daftar_siswa_kelompok_query:
        target_name = _extract_target_kelompok_name(query)
        if not target_name:
            inferred = _infer_latest_kelompok_from_recent_chat(supabase, room_id) if room_id else None
            if inferred and _contains_any(normalized, ["yang tidak termasuk", "jangan dimasukkan", "hanya yang termasuk", "hanya yang terdaftar"]):
                target_name = inferred

        if not target_name:
            return "Sebutkan nama kelompoknya. Contoh: 'Daftar siswa kelompok A'."

        try:
            active_year_id = _get_tahun_ajaran_id()
        except Exception as exc:
            return f"Gagal menentukan tahun ajaran aktif: {exc}"

        return _format_student_list_by_kelompok(
            supabase,
            ra_id=ra_id,
            tahun_ajaran_id=active_year_id,
            nama_kelompok_target=target_name,
        )

    strict_filter_followup_query = _contains_any(
        normalized,
        ["yang tidak termasuk", "jangan dimasukkan", "hanya yang termasuk", "hanya yang terdaftar"],
    )
    if strict_filter_followup_query and room_id:
        inferred = _infer_latest_kelompok_from_recent_chat(supabase, room_id)
        if inferred:
            try:
                active_year_id = _get_tahun_ajaran_id()
            except Exception as exc:
                return f"Gagal menentukan tahun ajaran aktif: {exc}"
            return _format_student_list_by_kelompok(
                supabase,
                ra_id=ra_id,
                tahun_ajaran_id=active_year_id,
                nama_kelompok_target=inferred,
            )

    detail_siswa_query = _contains_any(normalized, ["detail siswa", "profil siswa", "data siswa"]) and not _contains_any(
        normalized, ["kelompok", "kelas", "rombel"]
    )
    if detail_siswa_query:
        match = re.search(r"(?:detail|profil|data)\s+siswa\s+([A-Za-z][A-Za-z' .-]{1,80})", query, flags=re.IGNORECASE)
        if not match:
            return None

        nama_target = _sanitize_person_name(match.group(1))
        try:
            active_year_id = _get_tahun_ajaran_id()
            siswa_rows = (
                supabase.table("siswa")
                .select("nama,tingkat_rombel,nisn,status_aktif,tanggal_lahir,jenis_kelamin")
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", active_year_id)
                .ilike("nama", f"%{nama_target}%")
                .order("nama")
                .limit(8)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil detail siswa: {exc}"

        if not siswa_rows:
            return f"Siswa dengan nama '{nama_target}' tidak ditemukan."

        if len(siswa_rows) > 1:
            options = [item.get("nama") for item in siswa_rows if isinstance(item, dict) and item.get("nama")]
            return "Ditemukan beberapa nama serupa: " + ", ".join(options[:6]) + ". Sebutkan nama lebih lengkap."

        siswa = siswa_rows[0] if isinstance(siswa_rows[0], dict) else {}
        if not siswa:
            return f"Siswa dengan nama '{nama_target}' tidak ditemukan."

        status_label = "Aktif" if siswa.get("status_aktif") else "Nonaktif"
        return (
            f"Detail siswa {siswa.get('nama') or nama_target}: "
            f"Kelompok {siswa.get('tingkat_rombel') or '-'}, NISN {siswa.get('nisn') or '-'}, "
            f"Jenis kelamin {siswa.get('jenis_kelamin') or '-'}, Tanggal lahir {siswa.get('tanggal_lahir') or '-'}, "
            f"Status {status_label}."
        )

    surat_query = _contains_any(
        normalized,
        ["surat terbaru", "daftar surat", "list surat", "jumlah surat", "arsip surat", "nomor surat"],
    )
    if surat_query:
        try:
            surat_rows = (
                supabase.table("surat_keluar")
                .select("nomor_surat,judul,created_at")
                .eq("ra_id", ra_id)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil data surat: {exc}"

        if not surat_rows:
            return "Belum ada arsip surat pada RA ini."

        count_only = _contains_any(normalized, ["jumlah", "berapa", "total"]) and not _contains_any(
            normalized, ["daftar", "list", "terbaru", "nomor"]
        )
        if count_only:
            return f"Total arsip surat saat ini: {len(surat_rows)} data terbaru terambil."

        lines = []
        for item in surat_rows[:10]:
            if not isinstance(item, dict):
                continue
            lines.append(
                f"- {item.get('nomor_surat') or '-'} | {item.get('judul') or '-'} | {_format_date_id(item.get('created_at'))}"
            )
        return f"Surat terbaru (total {len(surat_rows)} data terbaru):\n" + "\n".join(lines)

    template_surat_query = _contains_any(
        normalized,
        ["template surat", "daftar template", "jenis surat", "template yang ada"],
    )
    if template_surat_query:
        try:
            template_rows = (
                supabase.table("surat_template")
                .select("nama_template,jenis_surat")
                .eq("ra_id", ra_id)
                .order("nama_template")
                .limit(50)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil data template surat: {exc}"

        if not template_rows:
            return "Belum ada template surat pada RA ini."

        lines = [
            f"- {item.get('nama_template') or '-'} ({item.get('jenis_surat') or '-'})"
            for item in template_rows[:20]
            if isinstance(item, dict)
        ]
        return f"Template surat tersedia (total {len(template_rows)}):\n" + "\n".join(lines)

    knowledge_query = _contains_any(
        normalized,
        ["knowledge", "knowledge base", "dokumen", "materi", "file knowledge", "dokumen kb"],
    )
    if knowledge_query:
        try:
            docs_rows = (
                supabase.table("knowledge_docs")
                .select("nama_file,uploaded_at")
                .eq("ra_id", ra_id)
                .order("uploaded_at", desc=True)
                .limit(20)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil data knowledge base: {exc}"

        if not docs_rows:
            return "Belum ada dokumen knowledge base pada RA ini."

        count_only = _contains_any(normalized, ["jumlah", "berapa", "total"]) and not _contains_any(
            normalized, ["daftar", "list", "terbaru"]
        )
        if count_only:
            return f"Jumlah dokumen knowledge base saat ini: {len(docs_rows)} dokumen (data terbaru)."

        lines = [
            f"- {item.get('nama_file') or '-'} | {_format_date_id(item.get('uploaded_at'))}"
            for item in docs_rows[:10]
            if isinstance(item, dict)
        ]
        return f"Dokumen knowledge terbaru (total {len(docs_rows)} data terbaru):\n" + "\n".join(lines)

    notifikasi_query = _contains_any(
        normalized,
        ["notifikasi", "pemberitahuan", "notif belum dibaca", "jumlah notif"],
    )
    if notifikasi_query:
        try:
            notif_rows = (
                supabase.table("notifikasi")
                .select("judul,dibaca,created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(30)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil notifikasi: {exc}"

        if not notif_rows:
            return "Tidak ada notifikasi untuk akun Anda saat ini."

        unread = sum(1 for item in notif_rows if isinstance(item, dict) and not item.get("dibaca"))
        count_only = _contains_any(normalized, ["jumlah", "berapa", "total"]) and not _contains_any(
            normalized, ["daftar", "list", "judul"]
        )
        if count_only:
            return f"Notifikasi Anda: total {len(notif_rows)} terbaru, belum dibaca {unread}."

        lines = []
        for item in notif_rows[:10]:
            if not isinstance(item, dict):
                continue
            status_notif = "belum dibaca" if not item.get("dibaca") else "dibaca"
            lines.append(f"- {item.get('judul') or '-'} ({status_notif}, {_format_date_id(item.get('created_at'))})")

        return f"Notifikasi terbaru (belum dibaca {unread}):\n" + "\n".join(lines)

    chat_room_query = _contains_any(normalized, ["chat room", "ruang chat", "jumlah room", "daftar room"])
    if chat_room_query:
        try:
            room_rows = (
                supabase.table("chat_ruang")
                .select("nama,tipe")
                .eq("ra_id", ra_id)
                .order("nama")
                .limit(80)
                .execute()
            ).data or []
        except Exception as exc:
            return f"Gagal mengambil daftar room chat: {exc}"

        if not room_rows:
            return "Belum ada room chat pada RA ini."

        lines = [
            f"- {item.get('nama') or '-'} ({item.get('tipe') or '-'})"
            for item in room_rows[:20]
            if isinstance(item, dict)
        ]
        return f"Daftar room chat (total {len(room_rows)}):\n" + "\n".join(lines)

    return None


def _build_recent_chat_context(supabase, room_id: str, max_messages: int = 10) -> str | None:
    try:
        rows = (
            supabase.table("chat_riwayat")
            .select("role_msg,content,timestamp")
            .eq("room_id", room_id)
            .order("timestamp", desc=True)
            .limit(max_messages)
            .execute()
        ).data or []
    except Exception:
        return None

    if not rows:
        return None

    chronological = [row for row in reversed(rows) if isinstance(row, dict)]
    lines = []
    for row in chronological:
        role = "User" if row.get("role_msg") == "user" else "Asisten"
        content = (row.get("content") or "").strip()
        if not content:
            continue
        clipped = content[:280] + "..." if len(content) > 280 else content
        lines.append(f"{role}: {clipped}")

    return "\n".join(lines) if lines else None


def _build_grounded_ai_response(supabase, current: dict, query: str, room_id: str | None = None) -> str:
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
        "Jangan mengarang nama sekolah, nama kepala RA, atau identitas institusi. "
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

    recent_chat_context = _build_recent_chat_context(supabase, room_id, max_messages=10) if room_id else None
    if recent_chat_context:
        enhanced_prompt = (
            f"{enhanced_prompt}\n\n"
            "RIWAYAT PERCAKAPAN TERBARU (GUNAKAN JIKA RELEVAN):\n"
            f"{recent_chat_context}\n\n"
            "Gunakan riwayat percakapan untuk menjaga konteks, tetapi tetap prioritaskan kebenaran data sistem saat ini."
        )

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
            supabase.table("chat_riwayat")
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


def _ensure_chat_admin_permission(current: dict):
    role = ((current.get("profile") or {}).get("role") or "").lower()
    if not _is_admin_role(role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Kepala/Admin yang dapat mengatur kamus chat lokal.",
        )


@router.get("/vocabulary", response_model=ChatVocabularySettingsResponse)
def get_chat_vocabulary_settings(current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    settings_row = _load_ra_chat_vocabulary(supabase, ra_id)

    return {
        "success": True,
        "message": "Pengaturan kamus chat lokal berhasil diambil",
        "data": settings_row,
    }


@router.put("/vocabulary", response_model=ChatVocabularySettingsResponse)
def upsert_chat_vocabulary_settings(
    payload: ChatVocabularySettingsRequest,
    current=Depends(get_current_user_profile),
):
    _ensure_chat_admin_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    token_map = _sanitize_custom_vocab_map(payload.token_map)
    phrase_map = _sanitize_custom_vocab_map(payload.phrase_map)

    try:
        supabase.table("chat_local_vocabulary").upsert(
            {
                "ra_id": ra_id,
                "token_map": token_map,
                "phrase_map": phrase_map,
                "updated_by": user_id,
            },
            on_conflict="ra_id",
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan kamus chat lokal: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Kamus chat lokal berhasil diperbarui",
        "data": {
            "token_map": token_map,
            "phrase_map": phrase_map,
        },
    }


@router.delete("/vocabulary", response_model=ChatVocabularySettingsResponse)
def reset_chat_vocabulary_settings(current=Depends(get_current_user_profile)):
    _ensure_chat_admin_permission(current)

    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

    try:
        supabase.table("chat_local_vocabulary").upsert(
            {
                "ra_id": ra_id,
                "token_map": {},
                "phrase_map": {},
                "updated_by": user_id,
            },
            on_conflict="ra_id",
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mereset kamus chat lokal: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Kamus chat lokal berhasil direset",
        "data": {
            "token_map": {},
            "phrase_map": {},
        },
    }


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
            supabase.table("chat_ruang")
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
                supabase.table("chat_ruang")
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
            supabase.table("chat_ruang")
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
        supabase.table("chat_riwayat").delete().eq("room_id", room_id).execute()
        supabase.table("chat_ruang").delete().eq("id", room_id).eq("ra_id", ra_id).execute()
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
            supabase.table("chat_ruang")
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
            supabase.table("chat_riwayat")
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
                    supabase.table("chat_riwayat")
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
                    supabase.table("chat_riwayat")
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
            supabase.table("chat_ruang")
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
            supabase.table("chat_riwayat")
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

    local_vocab = _load_ra_chat_vocabulary(supabase, ra_id)
    effective_query = _apply_custom_vocabulary(payload.content, local_vocab) or payload.content

    context_text = _build_system_data_context(supabase, current, effective_query)
    
    from app.utils.gemini import analyze_chat_intent
    try:
        intent_data = analyze_chat_intent(effective_query, context_text)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menganalisis intent AI: {exc}",
        ) from exc

    intent = intent_data.get("intent", "tanya_jawab")
    params = intent_data.get("parameters", {})
    ai_response_text = intent_data.get("reply_message") or "Pesan diproses."

    if intent == "catat_presensi":
        records = params.get("records", [])
        if records:
            tahun_ajaran_id = get_active_academic_year(supabase, ra_id, created_by=user_id)["id"]
            for record in records:
                nama_siswa = record.get("nama_siswa")
                status_val = record.get("status")
                tanggal_val = record.get("tanggal") or datetime.now(timezone.utc).date().isoformat()
                
                siswa_row, error_kind, candidates = _resolve_student_for_action(supabase, ra_id, tahun_ajaran_id, nama_siswa)
                if isinstance(siswa_row, dict) and siswa_row.get("id"):
                    # Insert or update
                    supabase.table("presensi").upsert({
                        "siswa_id": siswa_row["id"],
                        "tahun_ajaran_id": tahun_ajaran_id,
                        "tanggal": tanggal_val,
                        "status": status_val,
                        "keterangan": record.get("keterangan"),
                        "created_by": user_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }, on_conflict="siswa_id,tanggal,tahun_ajaran_id").execute()

    bot_message = _save_assistant_message(
        supabase,
        user_id,
        room_id,
        ai_response_text,
        "Gagal menyimpan respons bot",
    )
    
    # Inject intent and parameters so frontend can act on them if needed (e.g., buat_rpph)
    bot_message["intent"] = intent
    bot_message["parameters"] = params

    return {
        "success": True,
        "message": "Pesan berhasil diproses",
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
            supabase.table("chat_ruang")
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
            supabase.table("chat_riwayat")
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

    local_vocab = _load_ra_chat_vocabulary(supabase, ra_id)
    effective_query = _apply_custom_vocabulary(transcription, local_vocab) or transcription

    context_text = _build_system_data_context(supabase, current, effective_query)
    
    from app.utils.gemini import analyze_chat_intent
    try:
        intent_data = analyze_chat_intent(effective_query, context_text)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menganalisis intent AI: {exc}",
        ) from exc

    intent = intent_data.get("intent", "tanya_jawab")
    params = intent_data.get("parameters", {})
    ai_response_text = intent_data.get("reply_message") or "Voice message diproses."

    if intent == "catat_presensi":
        records = params.get("records", [])
        if records:
            tahun_ajaran_id = get_active_academic_year(supabase, ra_id, created_by=user_id)["id"]
            for record in records:
                nama_siswa = record.get("nama_siswa")
                status_val = record.get("status")
                tanggal_val = record.get("tanggal") or datetime.now(timezone.utc).date().isoformat()
                
                siswa_row, error_kind, candidates = _resolve_student_for_action(supabase, ra_id, tahun_ajaran_id, nama_siswa)
                if isinstance(siswa_row, dict) and siswa_row.get("id"):
                    # Insert or update
                    supabase.table("presensi").upsert({
                        "siswa_id": siswa_row["id"],
                        "tahun_ajaran_id": tahun_ajaran_id,
                        "tanggal": tanggal_val,
                        "status": status_val,
                        "keterangan": record.get("keterangan"),
                        "created_by": user_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }, on_conflict="siswa_id,tanggal,tahun_ajaran_id").execute()

    bot_message = _save_assistant_message(
        supabase,
        user_id,
        room_id,
        ai_response_text,
        "Gagal menyimpan respons bot",
    )
    
    bot_message["intent"] = intent
    bot_message["parameters"] = params

    return {
        "success": True,
        "message": "Voice message berhasil diproses",
        "data": {
            "user_message": user_message,
            "bot_message": bot_message,
        },
        "transcription": transcription,
    }
