from typing import Optional

from pydantic import BaseModel


class TahunAjaranCreateRequest(BaseModel):
    label: str


class TahunAjaranConfigUpdateRequest(BaseModel):
    hari_efektif_belajar: int


class KalenderPendidikanSyncRequest(BaseModel):
    replace_existing: bool = True


class KalenderPendidikanCreateRequest(BaseModel):
    tanggal: str
    nama_event: str
    is_holiday: bool = True
    keterangan: Optional[str] = None


class TahunAjaranItem(BaseModel):
    id: str
    ra_id: str
    label: str
    is_active: bool
    hari_efektif_belajar: int = 5
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class KalenderPendidikanItem(BaseModel):
    id: str
    tahun_ajaran_id: str
    tanggal: str
    nama_event: str
    is_holiday: bool
    sumber: str
    keterangan: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class KalenderPendidikanListResponse(BaseModel):
    success: bool
    message: str
    data: list[KalenderPendidikanItem]


class KalenderPendidikanDeleteResponse(BaseModel):
    success: bool
    message: str
    data: dict


class TahunAjaranListResponse(BaseModel):
    success: bool
    data: list[TahunAjaranItem]
    active_id: Optional[str] = None


class TahunAjaranDetailResponse(BaseModel):
    success: bool
    message: str
    data: TahunAjaranItem
