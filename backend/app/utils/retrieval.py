from typing import List, Dict
from app.database import get_supabase_client
from app.utils.embeddings import generate_query_embedding
import logging

logger = logging.getLogger(__name__)

def retrieve_relevant_context(
    query: str,
    ra_id: int,
    top_k: int = 3,
    similarity_threshold: float = 0.5
) -> List[Dict]:
    """
    Cari chunks yang relevan dari knowledge base menggunakan vector similarity.
    
    Args:
        query: Query text dari user
        ra_id: ID RA untuk filtering
        top_k: Jumlah maksimal chunks yang dikembalikan
        similarity_threshold: Threshold minimal untuk similarity score (0-1)
    
    Returns:
        List of relevant chunks dengan content dan similarity score
    """
    try:
        supabase = get_supabase_client()
        
        # Generate embedding untuk query
        query_embedding = generate_query_embedding(query)
        
        # Panggil RPC function untuk similarity search
        # Function ini harus dibuat di Supabase (lihat instruksi di bawah)
        result = supabase.rpc(
            'match_knowledge_chunks',
            {
                'query_embedding': query_embedding,
                'match_threshold': similarity_threshold,
                'match_count': top_k,
                'filter_ra_id': ra_id
            }
        ).execute()
        
        if result.data:
            logger.info(f"Found {len(result.data)} relevant chunks for query")
            return result.data
        
        return []
        
    except Exception as e:
        logger.error(f"Error retrieving context: {str(e)}")
        return []


def build_rag_prompt(user_query: str, context_chunks: List[Dict]) -> str:
    """
    Build prompt dengan konteks dari knowledge base.
    """
    if not context_chunks or len(context_chunks) == 0:
        return user_query
    
    # Format konteks
    context_text = "\n\n".join([
        f"[Dokumen {i+1}] {chunk['content']}"
        for i, chunk in enumerate(context_chunks)
    ])
    
    # Build prompt dengan konteks
    rag_prompt = f"""Kamu adalah asisten AI untuk guru RA (Raudhatul Athfal/TK Islam).

Berikut adalah informasi relevan dari knowledge base:

{context_text}

---

Gunakan informasi di atas untuk menjawab pertanyaan berikut jika relevan. Jika informasi di atas tidak cukup atau tidak relevan, kamu tetap bisa menjawab berdasarkan pengetahuanmu.

Pertanyaan: {user_query}

Jawaban:"""
    
    return rag_prompt
