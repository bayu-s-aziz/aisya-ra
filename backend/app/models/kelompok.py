from typing import Optional

from pydantic import BaseModel


class KelompokCreateRequest(BaseModel):
    nama_kelompok: str
    wali_kelas_id: Optional[str] = None


class KelompokUpdateRequest(BaseModel):
    nama_kelompok: Optional[str] = None
    wali_kelas_id: Optional[str] = None


class KelompokItem(BaseModel):
    id: str
    ra_id: str
    nama_kelompok: str
    wali_kelas_id: Optional[str] = None


class KelompokListResponse(BaseModel):
    success: bool
    data: list[KelompokItem]


class KelompokDetailResponse(BaseModel):
    success: bool
    message: str
    data: KelompokItem
