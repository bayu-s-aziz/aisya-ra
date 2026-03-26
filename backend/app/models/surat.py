from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

# ===== Template Surat Models =====

class JenisSurat(str):
    """Enum-like class for jenis surat"""
    UNDANGAN = "undangan"
    KETERANGAN = "keterangan"
    TUGAS = "tugas"
    IZIN = "izin"
    LAINNYA = "lainnya"

class TemplateSuratBase(BaseModel):
    nama_template: str
    jenis_surat: str
    konten_template: str  # HTML or text dengan placeholder seperti {{nama_siswa}}

class TemplateSuratCreate(TemplateSuratBase):
    pass

class TemplateSuratUpdate(BaseModel):
    nama_template: Optional[str] = None
    jenis_surat: Optional[str] = None
    konten_template: Optional[str] = None

class TemplateSuratResponse(TemplateSuratBase):
    id: str
    ra_id: str
    created_at: datetime

# ===== Surat Models =====

class SuratBase(BaseModel):
    judul: str

class SuratGenerateRequest(BaseModel):
    template_id: str
    judul: str
    parameters: Dict[str, Any]  # e.g., {"nama_siswa": "Ahmad", "tanggal": "10 Maret 2026"}
    kode_surat: Optional[str] = "RA"  # Default kode untuk format nomor

class SuratGenerateResponse(BaseModel):
    success: bool
    message: str
    surat_id: str
    nomor_surat: str

class SuratResponse(BaseModel):
    id: str
    ra_id: str
    template_id: Optional[str] = None
    nomor_surat: str
    judul: str
    konten_final: str
    file_pdf_url: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

class SuratListResponse(BaseModel):
    id: str
    nomor_surat: str
    judul: str
    jenis_surat: Optional[str] = None
    created_at: datetime
