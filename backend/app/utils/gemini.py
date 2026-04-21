from typing import Optional

from google import genai

from app.config import settings

SYSTEM_PROMPT = (
    "Kamu adalah AISYA, asisten administrasi guru RA.\n"
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
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
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


def _fallback_response() -> str:
    return (
        "Maaf, layanan AI sedang sibuk atau kuota API sedang habis. "
        "Silakan coba lagi beberapa saat lagi."
    )


def generate_response(prompt: str, context: Optional[str] = None) -> str:
    full_prompt = SYSTEM_PROMPT + "\n\n"
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
                if _is_model_not_found_error(exc):
                    continue
                gemini_error = exc
                break

        if not gemini_error:
            gemini_error = last_error

    if gemini_error and _is_quota_or_rate_limit_error(gemini_error):
        return _fallback_response()

    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY belum diset di environment variables")

    return _fallback_response()
