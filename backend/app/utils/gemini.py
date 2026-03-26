from typing import Optional

from google import genai
from groq import Groq

from app.config import settings

SYSTEM_PROMPT = "Kamu adalah asisten administrasi guru Raudhatul Athfal."
DEFAULT_MODEL_CANDIDATES = [
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


def _generate_with_groq(prompt: str, context: Optional[str] = None) -> str:
    if not settings.GROQ_API_KEY:
        return ""

    client = Groq(api_key=settings.GROQ_API_KEY)

    full_prompt = SYSTEM_PROMPT + "\n\n"
    if context:
        full_prompt += f"Konteks:\n{context}\n\n"
    full_prompt += f"Pertanyaan: {prompt}"

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": full_prompt,
            },
        ],
        temperature=0.4,
        max_tokens=1024,
    )

    return (response.choices[0].message.content or "").strip()


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

    try:
        groq_text = _generate_with_groq(prompt, context)
        if groq_text:
            return groq_text
    except Exception:
        pass

    if gemini_error and _is_quota_or_rate_limit_error(gemini_error):
        return _fallback_response()

    if not settings.GEMINI_API_KEY and not settings.GROQ_API_KEY:
        raise ValueError("GEMINI_API_KEY/GROQ_API_KEY belum diset di environment variables")

    return _fallback_response()
