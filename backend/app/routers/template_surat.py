from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.models.surat import (
    TemplateSuratCreate,
    TemplateSuratUpdate,
    TemplateSuratResponse
)
from app.utils.auth import get_current_user_profile
from app.database import get_supabase_client
from app.utils.surat import get_template_placeholders

router = APIRouter(prefix="/api/template-surat", tags=["template-surat"])

@router.post("/", response_model=TemplateSuratResponse)
async def create_template_surat(
    data: TemplateSuratCreate,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Buat template surat baru.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    try:
        response = supabase.table("surat_template").insert({
            "ra_id": ra_id,
            "nama_template": data.nama_template,
            "jenis_surat": data.jenis_surat,
            "konten_template": data.konten_template
        }).execute()
        
        if len(response.data) == 0:
            raise HTTPException(status_code=500, detail="Gagal membuat template surat")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/", response_model=List[TemplateSuratResponse])
async def list_template_surat(
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil daftar template surat milik RA ini.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    response = supabase.table("surat_template").select("*").eq(
        "ra_id", ra_id
    ).order("created_at", desc=True).execute()
    
    return response.data


@router.get("/{id}", response_model=TemplateSuratResponse)
async def get_template_surat(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil detail template surat.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    response = supabase.table("surat_template").select("*").eq("id", id).execute()
    
    if len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    
    template = response.data[0]
    if template["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke template ini")
    
    return template


@router.get("/{id}/placeholders")
async def get_template_placeholders_endpoint(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Ambil daftar placeholder yang ada di template.
    Berguna untuk mengetahui parameter apa saja yang harus diisi.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    response = supabase.table("surat_template").select("*").eq("id", id).execute()
    
    if len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    
    template = response.data[0]
    if template["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke template ini")
    
    placeholders = get_template_placeholders(template["konten_template"])
    
    return {
        "template_id": id,
        "nama_template": template["nama_template"],
        "placeholders": placeholders
    }


@router.put("/{id}", response_model=TemplateSuratResponse)
async def update_template_surat(
    id: str,
    data: TemplateSuratUpdate,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Update template surat.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Cek kepemilikan
    existing_response = supabase.table("surat_template").select("*").eq("id", id).execute()
    
    if len(existing_response.data) == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    
    if existing_response.data[0]["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke template ini")
    
    # Build update data
    update_data = {}
    if data.nama_template is not None:
        update_data["nama_template"] = data.nama_template
    if data.jenis_surat is not None:
        update_data["jenis_surat"] = data.jenis_surat
    if data.konten_template is not None:
        update_data["konten_template"] = data.konten_template
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diupdate")
    
    response = supabase.table("surat_template").update(update_data).eq("id", id).execute()
    
    if len(response.data) == 0:
        raise HTTPException(status_code=500, detail="Gagal mengupdate template")
    
    return response.data[0]


@router.delete("/{id}")
async def delete_template_surat(
    id: str,
    profile: dict = Depends(get_current_user_profile)
):
    """
    Hapus template surat.
    """
    supabase = get_supabase_client()
    ra_id = profile["ra_id"]
    
    # Cek kepemilikan
    existing_response = supabase.table("surat_template").select("*").eq("id", id).execute()
    
    if len(existing_response.data) == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    
    if existing_response.data[0]["ra_id"] != ra_id:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke template ini")
    
    # Hapus template
    delete_response = supabase.table("surat_template").delete().eq("id", id).execute()
    
    if len(delete_response.data) == 0:
        raise HTTPException(status_code=500, detail="Gagal menghapus template")
    
    return {"success": True, "message": "Template berhasil dihapus"}
