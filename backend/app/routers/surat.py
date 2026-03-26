from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from typing import List
import logging

from app.models.surat import (
    SuratGenerateRequest,
    SuratGenerateResponse,
    SuratResponse,
    SuratListResponse
)
from app.utils.auth import get_current_user_profile
from app.database import get_supabase_client
from app.utils.surat import generate_nomor_surat, fill_template
from app.utils.pdf import generate_pdf

router = APIRouter(prefix="/api/surat", tags=["surat"])
logger = logging.getLogger(__name__)

@router.post("/generate", response_model=SuratGenerateResponse)
async def generate_surat(
    data: SuratGenerateRequest,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Generate surat dari template dengan nomor otomatis.
    
    Proses:
    1. Ambil template dari database
    2. Generate nomor surat otomatis
    3. Isi template dengan parameters
    4. Simpan surat ke database
    5. (Opsional) Generate PDF
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    user_id = profile["profile"]["id"]
    
    # 1. Ambil template
    template_response = supabase.table("template_surat").select("*").eq(
        "id", data.template_id
    ).execute()
    
    if len(template_response.data) == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    
    template = template_response.data[0]
    
    # Validasi kepemilikan template
    if template["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke template ini")
    
    # 2. Generate nomor surat otomatis
    try:
        nomor_surat = generate_nomor_surat(ra_id, data.kode_surat)
    except Exception as e:
        logger.error(f"Error generating nomor surat: {str(e)}")
        raise HTTPException(status_code=500, detail="Gagal generate nomor surat")
    
    # 3. Isi template dengan parameters
    try:
        konten_final = fill_template(template["konten_template"], data.parameters)
    except Exception as e:
        logger.error(f"Error filling template: {str(e)}")
        raise HTTPException(status_code=500, detail="Gagal mengisi template")
    
    # 4. Simpan surat ke database
    try:
        surat_response = supabase.table("surat").insert({
            "ra_id": ra_id,
            "template_id": data.template_id,
            "nomor_surat": nomor_surat,
            "judul": data.judul,
            "konten_final": konten_final,
            "created_by": user_id
        }).execute()
        
        if len(surat_response.data) == 0:
            raise HTTPException(status_code=500, detail="Gagal menyimpan surat")
        
        surat = surat_response.data[0]
        surat_id = surat["id"]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving surat: {str(e)}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan surat")
    
    return SuratGenerateResponse(
        success=True,
        message="Surat berhasil di-generate",
        surat_id=surat_id,
        nomor_surat=nomor_surat
    )


@router.get("/", response_model=List[SuratListResponse])
async def list_surat(
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil daftar surat milik RA ini.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Join dengan template_surat untuk mendapatkan jenis_surat
    response = supabase.table("surat").select(
        "id, nomor_surat, judul, created_at, template_surat:template_id(jenis_surat)"
    ).eq("ra_id", ra_id).order("created_at", desc=True).execute()
    
    # Format response
    result = []
    for surat in response.data:
        jenis_surat = None
        if surat.get("template_surat") and isinstance(surat["template_surat"], dict):
            jenis_surat = surat["template_surat"].get("jenis_surat")
        
        result.append({
            "id": surat["id"],
            "nomor_surat": surat["nomor_surat"],
            "judul": surat["judul"],
            "jenis_surat": jenis_surat,
            "created_at": surat["created_at"]
        })
    
    return result


@router.get("/{id}", response_model=SuratResponse)
async def get_surat(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil detail surat.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    response = supabase.table("surat").select("*").eq("id", id).execute()
    
    if len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Surat tidak ditemukan")
    
    surat = response.data[0]
    
    if surat["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke surat ini")
    
    return surat


@router.get("/{id}/pdf")
async def get_surat_pdf(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Generate dan download PDF surat.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Ambil surat
    response = supabase.table("surat").select("*").eq("id", id).execute()
    
    if len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Surat tidak ditemukan")
    
    surat = response.data[0]
    
    if surat["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke surat ini")
    
    # Generate PDF
    try:
        # Build HTML untuk PDF
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: "Times New Roman", Times, serif;
                    padding: 2cm;
                    line-height: 1.6;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .nomor {{
                    text-align: right;
                    margin-bottom: 20px;
                }}
                .content {{
                    text-align: justify;
                    white-space: pre-wrap;
                }}
            </style>
        </head>
        <body>
            <div class="nomor">
                <strong>Nomor: {surat['nomor_surat']}</strong>
            </div>
            <div class="header">
                <h2>{surat['judul']}</h2>
            </div>
            <div class="content">
                {surat['konten_final']}
            </div>
        </body>
        </html>
        """
        
        pdf_bytes = generate_pdf(html_content)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=surat-{surat['nomor_surat'].replace('/', '-')}.pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        raise HTTPException(status_code=500, detail="Gagal generate PDF")


@router.delete("/{id}")
async def delete_surat(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Hapus surat.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Cek kepemilikan
    existing_response = supabase.table("surat").select("*").eq("id", id).execute()
    
    if len(existing_response.data) == 0:
        raise HTTPException(status_code=404, detail="Surat tidak ditemukan")
    
    if existing_response.data[0]["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke surat ini")
    
    # Hapus surat
    delete_response = supabase.table("surat").delete().eq("id", id).execute()
    
    if len(delete_response.data) == 0:
        raise HTTPException(status_code=500, detail="Gagal menghapus surat")
    
    return {"success": True, "message": "Surat berhasil dihapus"}
