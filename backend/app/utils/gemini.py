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
        "Kamu adalah AISYA, asisten administrasi guru Raudhatul Athfal Al-Islam.\n"
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
    "gemini-2.5-pro",          # Sesuai permintaan
    "gemini-2.5-flash",
    "gemini-2.0-pro",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
]

DEFAULT_EMBEDDING_MODELS = [
    "gemini-embedding-2",      # Multimodal embedding (Teks, Gambar, PDF)
    "text-embedding-004",      # Standar industri untuk teks
    "models/embedding-001",    # Legacy/Stable fallback
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
2. "buat_rpph": Jika user meminta membuat draft RPPH dan SEMUA parameternya sudah jelas.
   Parameter wajib:
   - "tema": string
   - "subtema": string
   - "kelompok": string
   - "hari": string (waktu kapan RPPH ini dibuat/dilaksanakan)
3. "buat_surat": Jika user meminta membuat surat resmi dan SEMUA parameternya sudah jelas.
   Parameter wajib:
   - "jenis_surat": string
   - "tanggal_surat": string
   - "pihak_dituju": string
   - "keterangan": string
4. "tanya_jawab": Jika user hanya bertanya biasa, meminta ringkasan data, ATAU jika user meminta buat_rpph/buat_surat TETAPI parameternya belum lengkap.
   Parameter wajib: tidak ada (kosongkan atau {{}})

ATURAN BALASAN (reply_message):
- Berikan balasan singkat, ramah, dan natural dalam bahasa Indonesia.
- Jika intent "buat_rpph" atau "buat_surat" tapi parameter belum lengkap, ubah intent menjadi "tanya_jawab" dan gunakan reply_message untuk BERTANYA kepada user secara spesifik parameter mana yang kurang (misal: "Untuk kelompok apa RPPH ini dibuat dan untuk kapan?" atau "Kepada siapa surat ini ditujukan dan tanggal berapa?").
- Jika intent adalah aksi (rpph/presensi/surat) dan SEMUA parameter lengkap, balas bahwa kamu sedang memprosesnya.
- Jika tanya_jawab murni, jawab berdasarkan Konteks. Jangan mengarang data.

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
                    # Temukan blok JSON object di dalam teks
                    json_match = re.search(r"\{.*\}", text, flags=re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                        try:
                            parsed = json.loads(json_str)
                            if isinstance(parsed, dict):
                                # Normalize keys to lowercase
                                normalized_parsed = {k.lower(): v for k, v in parsed.items()}
                                if "intent" in normalized_parsed and "reply_message" in normalized_parsed:
                                    # Also normalize intent value
                                    intent_val = str(normalized_parsed["intent"]).strip().lower()
                                    normalized_parsed["intent"] = intent_val
                                    
                                    # Fallback empty parameters if missing
                                    if "parameters" not in normalized_parsed:
                                        normalized_parsed["parameters"] = {}
                                        
                                    return normalized_parsed
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

def generate_embedding(text: str, model_name: Optional[str] = None) -> list[float]:
    """Menghasilkan vektor embedding untuk keperluan RAG."""
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY belum diset")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Gunakan model yang spesifik jika diminta, atau fallback melalui daftar default
    candidates = [model_name] if model_name else DEFAULT_EMBEDDING_MODELS
    
    last_error = None
    for model in candidates:
        try:
            # Note: SDK genai menggunakan client.models.embed_content
            response = client.models.embed_content(
                model=model,
                contents=text,
            )
            if hasattr(response, "embeddings") and response.embeddings:
                return response.embeddings[0].values
        except Exception as exc:
            last_error = exc
            continue
            
    if last_error:
        raise last_error
    return []

