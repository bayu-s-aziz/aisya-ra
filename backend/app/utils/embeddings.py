from typing import List

from google import genai

from app.config import settings

EMBEDDING_MODEL_CANDIDATES = [
    "gemini-embedding-001",
    "models/gemini-embedding-001",
    "text-embedding-004",
    "models/text-embedding-004",
]

TASK_TYPE_CANDIDATES = {
    "document": ["RETRIEVAL_DOCUMENT", "SEMANTIC_SIMILARITY"],
    "query": ["RETRIEVAL_QUERY", "SEMANTIC_SIMILARITY"],
}


def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY belum diset di environment variables")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _extract_embedding_values(response) -> List[float]:
    embeddings = getattr(response, "embeddings", None)
    if embeddings and len(embeddings) > 0:
        values = getattr(embeddings[0], "values", None)
        if values:
            return values

    if isinstance(response, dict):
        items = response.get("embeddings") or []
        if items and isinstance(items[0], dict):
            values = items[0].get("values")
            if values:
                return values

    raise RuntimeError("Embedding response tidak memiliki nilai vector")

def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding vector untuk teks menggunakan Gemini Embedding API.
    Model: models/text-embedding-004 (768 dimensions)
    """
    client = _get_client()
    last_error = None

    for model_name in EMBEDDING_MODEL_CANDIDATES:
        for task_type in TASK_TYPE_CANDIDATES["document"]:
            try:
                result = client.models.embed_content(
                    model=model_name,
                    contents=text,
                    config={"task_type": task_type},
                )
                return _extract_embedding_values(result)
            except Exception as exc:
                last_error = exc

    raise Exception(f"Failed to generate embedding: {str(last_error)}")


def generate_query_embedding(text: str) -> List[float]:
    """
    Generate embedding vector untuk query pencarian.
    """
    client = _get_client()
    last_error = None

    for model_name in EMBEDDING_MODEL_CANDIDATES:
        for task_type in TASK_TYPE_CANDIDATES["query"]:
            try:
                result = client.models.embed_content(
                    model=model_name,
                    contents=text,
                    config={"task_type": task_type},
                )
                return _extract_embedding_values(result)
            except Exception as exc:
                last_error = exc

    raise Exception(f"Failed to generate query embedding: {str(last_error)}")
