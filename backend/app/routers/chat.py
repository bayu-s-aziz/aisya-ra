from datetime import datetime, timezone
import re

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
from app.utils.dashboard_chat_formatter import (
    build_dashboard_text_from_endpoint,
    is_refresh_command,
)

router = APIRouter()


VALID_TIPE = {'utama', 'rpph', 'anekdot', 'surat', 'presensi', 'custom', 'dashboard'}


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


def _build_students_context(supabase, ra_id: str, query: str) -> str | None:
    if not _looks_like_student_query(query):
        return None

    try:
        kelompok_resp = (
            supabase.table("kelompok")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
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


def _build_presensi_context(supabase, ra_id: str) -> str | None:
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        siswa_resp = (
            supabase.table("siswa")
            .select("id,nama,kelompok_id")
            .eq("ra_id", ra_id)
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


def _build_rpph_context(supabase, ra_id: str) -> str | None:
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

    request_all_data = _is_requesting_all_data(query)
    sections = []

    if request_all_data or _looks_like_student_query(query):
        students = _build_students_context(supabase, ra_id, query)
        if students:
            sections.append(("MANAJEMEN SISWA", students))

    if request_all_data or _contains_any(query, ["guru", "pengguna", "user", "akun", "pegawai", "gtk"]):
        users = _build_users_context(supabase, ra_id, can_view_sensitive=can_view_sensitive)
        if users:
            sections.append(("MANAJEMEN PENGGUNA/GURU", users))

    if request_all_data or _contains_any(query, ["presensi", "kehadiran", "hadir", "izin", "sakit", "alpha"]):
        presensi = _build_presensi_context(supabase, ra_id)
        if presensi:
            sections.append(("PRESENSI", presensi))

    if request_all_data or _contains_any(query, ["rpph", "rencana pembelajaran", "tema", "subtema"]):
        rpph = _build_rpph_context(supabase, ra_id)
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

    try:
        response = (
            supabase.table("chat_rooms")
            .select("id,ra_id,tipe,nama")
            .eq("ra_id", ra_id)
            .order("nama")
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar ruang chat: {exc}",
        ) from exc

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

    room_tipe = (room_check.data[0].get("tipe") or "").lower()
    try:
        count_response = (
            supabase.table("chat_history")
            .select("id", count="exact")
            .eq("room_id", room_id)
            .execute()
        )
        total = count_response.count or 0

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
            messages_response = type("EmptyResponse", (), {"data": []})()
        else:
            start = max(total - (page * limit), 0)
            end = total - ((page - 1) * limit) - 1

            if start > end:
                messages_response = type("EmptyResponse", (), {"data": []})()
            else:
                messages_response = (
                    supabase.table("chat_history")
                    .select("id,user_id,room_id,role_msg,content,timestamp")
                    .eq("room_id", room_id)
                    .order("timestamp", desc=False)
                    .range(start, end)
                    .execute()
                )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil pesan chat: {exc}",
        ) from exc

    return {
        "success": True,
        "data": messages_response.data or [],
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

    room_tipe = (room_check.data[0].get("tipe") or "").lower()
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

        try:
            bot_message_response = (
                supabase.table("chat_history")
                .insert(
                    {
                        "user_id": user_id,
                        "room_id": room_id,
                        "role_msg": "assistant",
                        "content": stats_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                .execute()
            )
            bot_message = bot_message_response.data[0] if bot_message_response.data else {}
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gagal menyimpan respons dashboard: {exc}",
            ) from exc

        return {
            "success": True,
            "message": "Dashboard diperbarui" if requested_refresh else "Dashboard ditampilkan",
            "data": {"user_message": user_message, "bot_message": bot_message},
        }

    # -----------------------------------------------------------------------
    # Normal rooms: RAG + Gemini
    # -----------------------------------------------------------------------

    # Retrieve relevant context from knowledge base (RAG)
    context_chunks = retrieve_relevant_context(
        query=payload.content,
        ra_id=ra_id,
        top_k=3,
        similarity_threshold=0.5
    )

    # Build prompt dengan konteks jika ada
    if context_chunks and len(context_chunks) > 0:
        enhanced_prompt = build_rag_prompt(payload.content, context_chunks)
    else:
        enhanced_prompt = payload.content

    system_data_context = _build_system_data_context(supabase, current, payload.content)
    if system_data_context:
        enhanced_prompt = (
            f"{enhanced_prompt}\n\n"
            "KONTEKS DATA INTERNAL SISTEM (SUMBER UTAMA):\n"
            f"{system_data_context}\n\n"
            "Instruksi tambahan: Jika pertanyaan user terkait data operasional RA, utamakan konteks data internal sistem ini."
        )

    try:
        ai_response_text = generate_response(enhanced_prompt)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghasilkan respons AI: {exc}",
        ) from exc

    try:
        bot_message_response = (
            supabase.table("chat_history")
            .insert(
                {
                    "user_id": user_id,
                    "room_id": room_id,
                    "role_msg": "assistant",
                    "content": ai_response_text,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )
        bot_message = bot_message_response.data[0] if bot_message_response.data else {}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menyimpan respons bot: {exc}",
        ) from exc

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
    supabase = get_supabase_client()
    ra_id = current["ra_id"]
    user_id = current["profile"]["id"]

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

    # Generate AI response
    try:
        ai_response_text = generate_response(transcription)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghasilkan respons AI: {exc}",
        ) from exc

    # Save bot response
    try:
        bot_message_response = (
            supabase.table("chat_history")
            .insert(
                {
                    "user_id": user_id,
                    "room_id": room_id,
                    "role_msg": "assistant",
                    "content": ai_response_text,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )
        bot_message = bot_message_response.data[0] if bot_message_response.data else {}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menyimpan respons bot: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Voice message berhasil diproses",
        "data": {
            "user_message": user_message,
            "bot_message": bot_message,
        },
        "transcription": transcription,
    }
