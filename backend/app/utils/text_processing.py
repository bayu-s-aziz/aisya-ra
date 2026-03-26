from typing import List
import re

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Split teks menjadi chunks dengan ukuran tertentu dan overlap.
    """
    if not text or len(text.strip()) == 0:
        return []
    
    # Bersihkan teks dari whitespace berlebih
    text = re.sub(r'\s+', ' ', text).strip()
    
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        
        # Jika ini bukan chunk terakhir, cari titik break yang baik (akhir kalimat)
        if end < text_length:
            # Cari titik, tanda tanya, atau tanda seru terdekat
            break_point = max(
                text.rfind('.', start, end),
                text.rfind('!', start, end),
                text.rfind('?', start, end)
            )
            
            # Jika ditemukan, gunakan sebagai endpoint
            if break_point > start:
                end = break_point + 1
            else:
                # Jika tidak ada, cari spasi terdekat
                space_point = text.rfind(' ', start, end)
                if space_point > start:
                    end = space_point
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        
        # Move start dengan memperhitungkan overlap
        start = end - overlap if end < text_length else text_length
    
    return chunks
