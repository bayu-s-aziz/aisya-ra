import mimetypes

from google import genai
from google.genai import types

from app.config import settings


def transcribe_audio(file_bytes: bytes, filename: str = "audio.wav") -> str:
    """
    Transcribe audio file using Google AI Studio (Gemini).
    
    Args:
        file_bytes: Audio file content in bytes
        filename: Original filename (for content type detection)
    
    Returns:
        Transcribed text
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY belum diset di environment variables")

    if not file_bytes:
        raise ValueError("File audio kosong")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    mime_type, _ = mimetypes.guess_type(filename or "audio.wav")
    audio_mime_type = mime_type or "audio/wav"
    model_name = getattr(settings, "GEMINI_TRANSCRIBE_MODEL", "") or getattr(settings, "GEMINI_MODEL", "") or "gemini-2.5-flash"

    prompt = (
        "Transkripsikan audio ini ke teks bahasa Indonesia dengan akurat. "
        "Kembalikan hanya teks transkripsinya tanpa tambahan penjelasan."
    )

    response = client.models.generate_content(
        model=model_name,
        contents=[
            prompt,
            types.Part.from_bytes(data=file_bytes, mime_type=audio_mime_type),
        ],
    )

    return (getattr(response, "text", None) or "").strip()
