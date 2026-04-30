import json
from typing import Optional

from google import genai    

from app.config import settings

def _build_system_prompt() -> str:
    """Build system prompt with injected current date/time in WIB (UTC+7)."""
    from datetime import datetime, timezone, timedelta
    wib = timezone(timedelta(hours=7))
    now_wib = datetime.now(wib)
    hari_map = {
        0: "Senin", 1: "Selasa", 2: "Rabu", 3: "Kamis",
        4: "Jumat", 5: "Sabtu", 6: "Minggu",
    }
    bulan_map = {
        1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
        5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
        9: "September", 10: "Oktober", 11: "November", 12: "Desember",
    }
    hari = hari_map[now_wib.weekday()]
    tanggal_str = f"{hari}, {now_wib.day} {bulan_map[now_wib.month]} {now_wib.year}"
    jam_str = now_wib.strftime("%H:%M")

    return (
        "Kamu adalah AISYA, asisten administrasi guru RA.\n"
        f"Waktu saat ini: {tanggal_str}, pukul {jam_str}.\n"
        "Gaya jawaban wajib:\n"
        "- Singkat, to the point, dan bahasa Indonesia sederhana.\n"
        "- Hindari istilah teknis internal sistem, nama tabel, nama kolom, JSON, atau kode.\n"
        "- Maksimal 5 kalimat, atau maksimal 4 bullet jika perlu.\n"
        "- Untuk permintaan aksi data, jelaskan hasil akhirnya secara jelas dan ringkas.\n"
        "- Jika informasi kurang, minta 1 klarifikasi singkat.\n"
        "- Jangan mengasumsikan nama sekolah, kepala RA, atau data profil lain tanpa konteks data yang tersedia."
    )

DEFAULT_MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
]


def _is_model_not_found_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "is not found" in message or "404" in message


def _is_quota_or_rate_limit_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "resourceexhausted" in message
        or "quota" in message
        or "rate limit" in message
        or "429" in message
    )


def _fallback_response(exc: Optional[Exception] = None) -> str:
    if exc and _is_quota_or_rate_limit_error(exc):
        return (
            "Maaf, kuota layanan AI sedang habis. "
            "Silakan coba lagi beberapa saat lagi."
        )
    return (
        "Maaf, terjadi kendala teknis saat menghubungi layanan AI. "
        "Silakan coba lagi atau hubungi admin jika masalah berlanjut."
    )


def generate_response(prompt: str, context: Optional[str] = None) -> str:
    full_prompt = _build_system_prompt() + "\n\n"
    if context:
        full_prompt += f"Konteks:\n{context}\n\n"
    full_prompt += f"Pertanyaan: {prompt}"

    gemini_error: Optional[Exception] = None

    if settings.GEMINI_API_KEY:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        configured_model = getattr(settings, "GEMINI_MODEL", "") or ""
        candidate_models = [configured_model, *DEFAULT_MODEL_CANDIDATES] if configured_model else DEFAULT_MODEL_CANDIDATES

        deduped_candidates = []
        for model_name in candidate_models:
            if model_name and model_name not in deduped_candidates:
                deduped_candidates.append(model_name)

        last_error: Optional[Exception] = None
        for model_name in deduped_candidates:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=full_prompt,
                )
                text = (getattr(response, "text", None) or "").strip()
                if text:
                    return text
            except Exception as exc:
                last_error = exc
                # Try the next candidate model for any error (quota, structural, etc.)
                continue

        gemini_error = last_error

    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY belum diset di environment variables")

    return _fallback_response(gemini_error)

def analyze_chat_intent(prompt: str, context: Optional[str] = None) -> dict:
    from datetime import datetime, timezone, timedelta
    wib = timezone(timedelta(hours=7))
    now_wib = datetime.now(wib)
    hari_map = {
        0: "Senin", 1: "Selasa", 2: "Rabu", 3: "Kamis",
        4: "Jumat", 5: "Sabtu", 6: "Minggu",
    }
    bulan_map = {
        1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
        5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
        9: "September", 10: "Oktober", 11: "November", 12: "Desember",
    }
    hari = hari_map[now_wib.weekday()]
    tanggal_str = f"{hari}, {now_wib.day} {bulan_map[now_wib.month]} {now_wib.year}"
    jam_str = now_wib.strftime("%H:%M")

    system_instruction = f"""Kamu adalah AISYA, asisten AI untuk administrasi guru RA.
Waktu saat ini: {tanggal_str}, pukul {jam_str}.

Tugasmu adalah menganalisis pesan user dan mengekstrak niat (intent) serta parameternya dalam format JSON.

PILIHAN INTENT:
1. "catat_presensi": Jika user meminta mencatat kehadiran/ketidakhadiran siswa.
   Parameter wajib:
   - "records": array of objects [{{"nama_siswa": "...", "status": "hadir|sakit|izin|alpha", "tanggal": "YYYY-MM-DD", "keterangan": "..."}}]
2. "buat_rpph": Jika user meminta membuat draft RPPH.
   Parameter wajib:
   - "tema": string (atau null)
   - "subtema": string (atau null)
   - "kelompok": string (atau null)
   - "hari": string (atau null)
3. "buat_surat": Jika user meminta membuat atau menulis surat resmi.
   Parameter wajib:
   - "jenis_surat": string (atau null)
   - "keterangan": string (detail tambahan untuk surat)
4. "tanya_jawab": Jika user hanya bertanya biasa atau meminta ringkasan data yang ada di Konteks.
   Parameter wajib: tidak ada (kosongkan atau {{}})

ATURAN BALASAN (reply_message):
- Berikan balasan singkat, ramah, dan natural dalam bahasa Indonesia.
- Jika intent adalah aksi (rpph/presensi/surat), balas bahwa kamu sedang memproses atau telah mencatat hal tersebut sesuai perintah.
- Jika tanya_jawab, jawab pertanyaannya berdasarkan Konteks yang diberikan. Jangan mengarang data profil.

Konteks Sistem saat ini (Daftar Siswa, dll):
{context or "Tidak ada konteks"}

FORMAT OUTPUT WAJIB (HANYA JSON OBJECT):
{{
  "intent": "catat_presensi | buat_rpph | buat_surat | tanya_jawab",
  "parameters": {{ ... }},
  "reply_message": "..."
}}
"""

    full_prompt = system_instruction + f"\n\nPesan User: {prompt}"
    gemini_error = None

    if settings.GEMINI_API_KEY:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        configured_model = getattr(settings, "GEMINI_MODEL", "") or ""
        candidate_models = [configured_model, *DEFAULT_MODEL_CANDIDATES] if configured_model else DEFAULT_MODEL_CANDIDATES

        deduped_candidates = []
        for model_name in candidate_models:
            if model_name and model_name not in deduped_candidates:
                deduped_candidates.append(model_name)

        for model_name in deduped_candidates:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=full_prompt,
                )
                text = (getattr(response, "text", None) or "").strip()
                if text:
                    import re
                    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
                    text = re.sub(r"\s*```$", "", text)
                    try:
                        parsed = json.loads(text)
                        if isinstance(parsed, dict) and "intent" in parsed and "reply_message" in parsed:
                            return parsed
                    except json.JSONDecodeError:
                        continue
            except Exception as exc:
                gemini_error = exc
                continue

    return {
        "intent": "tanya_jawab",
        "parameters": {},
        "reply_message": _fallback_response(gemini_error)
    }

