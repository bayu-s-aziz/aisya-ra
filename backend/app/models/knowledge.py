from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class KnowledgeDocBase(BaseModel):
    nama_file: str

class KnowledgeDocCreate(KnowledgeDocBase):
    ra_id: str

class KnowledgeDocResponse(KnowledgeDocBase):
    id: str
    ra_id: str
    uploaded_at: datetime
    total_chunks: Optional[int] = 0

class KnowledgeChunkCreate(BaseModel):
    doc_id: str
    content: str
    embedding: List[float]

class KnowledgeChunkResponse(BaseModel):
    id: str
    doc_id: str
    content: str
    similarity: Optional[float] = None

class KnowledgeUploadResponse(BaseModel):
    success: bool
    message: str
    doc_id: str
    chunks_created: int
