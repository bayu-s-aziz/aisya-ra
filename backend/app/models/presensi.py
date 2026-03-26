from pydantic import BaseModel
from datetime import date
from enum import Enum
from typing import Optional

class StatusPresensi(str, Enum):
    hadir = "hadir"
    sakit = "sakit"
    izin = "izin"
    alpha = "alpha"

class PresensiBase(BaseModel):
    siswa_id: str
    tanggal: date
    status: StatusPresensi

class PresensiCreate(PresensiBase):
    pass

class PresensiUpdate(BaseModel):
    status: Optional[StatusPresensi] = None

class PresensiResponse(PresensiBase):
    id: str
    dicatat_oleh: str

class PresensiFromChatRequest(BaseModel):
    pesan: str
    room_id: str

class PresensiFromChatResponse(BaseModel):
    success: bool
    message: str
    jumlah_dicatat: int
    detail: list[dict]

class RekapPresensiResponse(BaseModel):
    tanggal: date
    kelompok_id: str
    kelompok_nama: str
    total_siswa: int
    hadir: int
    sakit: int
    izin: int
    alpha: int
    belum_dicatat: int
    detail: list[dict]


class PresensiBatchItem(BaseModel):
    siswa_id: str
    status: StatusPresensi


class PresensiBatchUpsertRequest(BaseModel):
    tanggal: date
    kelompok_id: str
    records: list[PresensiBatchItem]


class PresensiBatchUpsertResponse(BaseModel):
    success: bool
    message: str
    inserted: int
    updated: int
