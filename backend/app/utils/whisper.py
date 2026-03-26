from groq import Groq

from app.config import settings


def transcribe_audio(file_bytes: bytes, filename: str = "audio.wav") -> str:
    """
    Transcribe audio file using Groq Whisper API.
    
    Args:
        file_bytes: Audio file content in bytes
        filename: Original filename (for content type detection)
    
    Returns:
        Transcribed text
    """
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY belum diset di environment variables")

    client = Groq(api_key=settings.GROQ_API_KEY)

    # Create a file-like object from bytes
    from io import BytesIO
    audio_file = BytesIO(file_bytes)
    audio_file.name = filename

    transcription = client.audio.transcriptions.create(
        file=audio_file,
        model="whisper-large-v3",
        response_format="text",
    )

    return transcription
