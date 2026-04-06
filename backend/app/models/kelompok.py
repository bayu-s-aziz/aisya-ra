from typing import Optional

from pydantic import BaseModel


class KelompokCreateRequest(BaseModel):
    nama_kelompok: str
    wali_kelas_id: Optional[str] = None
    kode_rombel: Optional[str] = None
    tingkat: Optional[str] = None
    semester: Optional[str] = None
    kurikulum: Optional[str] = None
    ruang_kelas: Optional[str] = None
    kapasitas: Optional[int] = None
    status_rombel: Optional[str] = None


class KelompokUpdateRequest(BaseModel):
    nama_kelompok: Optional[str] = None
    wali_kelas_id: Optional[str] = None
    kode_rombel: Optional[str] = None
    tingkat: Optional[str] = None
    semester: Optional[str] = None
    kurikulum: Optional[str] = None
    ruang_kelas: Optional[str] = None
    kapasitas: Optional[int] = None
    status_rombel: Optional[str] = None


class KelompokItem(BaseModel):
    id: str
    ra_id: str
    nama_kelompok: str
    wali_kelas_id: Optional[str] = None
    kode_rombel: Optional[str] = None
    tingkat: Optional[str] = None
    semester: Optional[str] = None
    kurikulum: Optional[str] = None
    ruang_kelas: Optional[str] = None
    kapasitas: Optional[int] = None
    status_rombel: Optional[str] = None


class KelompokListResponse(BaseModel):
    success: bool
    data: list[KelompokItem]


class KelompokDetailResponse(BaseModel):
    success: bool
    message: str
    data: KelompokItem
