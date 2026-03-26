from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
import logging

from app.models.knowledge import (
    KnowledgeDocResponse,
    KnowledgeUploadResponse
)
from app.utils.auth import get_current_user_profile
from app.utils.file_parser import parse_file
from app.utils.text_processing import chunk_text
from app.utils.embeddings import generate_embedding
from app.database import get_supabase_client

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])
logger = logging.getLogger(__name__)

@router.post("/upload", response_model=KnowledgeUploadResponse)
async def upload_knowledge_document(
    file: UploadFile = File(...),
    profile: dict = Depends(get_current_user_profile)
):
    """
    Upload dokumen (PDF/DOCX/TXT) ke knowledge base.
    File akan di-parse, di-chunk, dan di-embed.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Validasi tipe file
    allowed_extensions = ['.pdf', '.docx', '.txt']
    filename = file.filename.lower()
    if not any(filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"File type not supported. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Baca file content
        file_content = await file.read()
        
        # Parse file ke text
        logger.info(f"Parsing file: {file.filename}")
        text = parse_file(file.filename, file_content)
        
        if not text or len(text.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="File kosong atau tidak dapat di-parse"
            )
        
        # Simpan dokumen ke database
        doc_response = supabase.table("knowledge_docs").insert({
            "ra_id": ra_id,
            "nama_file": file.filename
        }).execute()
        
        if len(doc_response.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create document")
        
        doc_id = doc_response.data[0]["id"]
        
        # Chunking text
        logger.info(f"Chunking text for doc {doc_id}")
        chunks = chunk_text(text, chunk_size=500, overlap=50)
        
        if len(chunks) == 0:
            # Hapus dokumen jika tidak ada chunks
            supabase.table("knowledge_docs").delete().eq("id", doc_id).execute()
            raise HTTPException(
                status_code=400,
                detail="Tidak dapat menghasilkan chunks dari dokumen"
            )
        
        # Generate embeddings dan simpan chunks
        logger.info(f"Generating embeddings for {len(chunks)} chunks")
        chunks_created = 0
        
        for i, chunk_content in enumerate(chunks):
            try:
                # Generate embedding
                embedding = generate_embedding(chunk_content)
                
                # Simpan chunk dengan embedding
                chunk_response = supabase.table("knowledge_chunks").insert({
                    "doc_id": doc_id,
                    "content": chunk_content,
                    "embedding": embedding
                }).execute()
                
                if len(chunk_response.data) > 0:
                    chunks_created += 1
                    
            except Exception as e:
                logger.error(f"Failed to process chunk {i}: {str(e)}")
                continue
        
        if chunks_created == 0:
            # Hapus dokumen jika tidak ada chunks yang berhasil
            supabase.table("knowledge_docs").delete().eq("id", doc_id).execute()
            raise HTTPException(
                status_code=500,
                detail="Failed to create any chunks with embeddings"
            )
        
        logger.info(f"Successfully created {chunks_created} chunks for doc {doc_id}")
        
        return KnowledgeUploadResponse(
            success=True,
            message=f"Dokumen berhasil diupload dan diproses menjadi {chunks_created} chunks",
            doc_id=doc_id,
            chunks_created=chunks_created
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document: {str(e)}"
        )


@router.get("/documents", response_model=List[KnowledgeDocResponse])
async def list_knowledge_documents(
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil daftar dokumen knowledge base milik RA ini.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Ambil dokumen dengan count chunks
    docs_response = supabase.table("knowledge_docs").select(
        "id, ra_id, nama_file, uploaded_at"
    ).eq("ra_id", ra_id).order("uploaded_at", desc=True).execute()
    
    # Untuk setiap dokumen, hitung jumlah chunks
    result = []
    for doc in docs_response.data:
        chunks_response = supabase.table("knowledge_chunks").select(
            "id", count="exact"
        ).eq("doc_id", doc["id"]).execute()
        
        doc["total_chunks"] = chunks_response.count if chunks_response.count else 0
        result.append(doc)
    
    return result


@router.delete("/documents/{id}")
async def delete_knowledge_document(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Hapus dokumen dan semua chunks-nya.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Validasi kepemilikan dokumen
    doc_response = supabase.table("knowledge_docs").select("id, ra_id").eq(
        "id", id
    ).execute()
    
    if len(doc_response.data) == 0:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    
    doc = doc_response.data[0]
    if doc["ra_id"] != ra_id:
        raise HTTPException(
            status_code=403,
            detail="Tidak memiliki akses ke dokumen ini"
        )
    
    # Hapus chunks terlebih dahulu
    supabase.table("knowledge_chunks").delete().eq("doc_id", id).execute()
    
    # Hapus dokumen
    delete_response = supabase.table("knowledge_docs").delete().eq("id", id).execute()
    
    if len(delete_response.data) == 0:
        raise HTTPException(status_code=500, detail="Failed to delete document")
    
    return {"success": True, "message": "Dokumen berhasil dihapus"}


@router.get("/documents/{id}/chunks")
async def get_knowledge_document_chunks(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil daftar chunk dokumen beserta embedding.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]

    doc_response = supabase.table("knowledge_docs").select("id, ra_id, nama_file").eq(
        "id", id
    ).execute()

    if len(doc_response.data) == 0:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")

    doc = doc_response.data[0]
    if doc["ra_id"] != ra_id:
        raise HTTPException(
            status_code=403,
            detail="Tidak memiliki akses ke dokumen ini"
        )

    chunks_response = (
        supabase.table("knowledge_chunks")
        .select("id, doc_id, content, embedding")
        .eq("doc_id", id)
        .order("id")
        .execute()
    )

    return {
        "success": True,
        "data": {
            "doc": doc,
            "chunks": chunks_response.data or [],
        },
    }
