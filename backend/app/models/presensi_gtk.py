from pydantic import BaseModel
from datetime import date, time
from typing import Optional
from .presensi import StatusPresensi

class PresensiGTKBase(BaseModel):
    pengguna_id: str
    tanggal: date
    status: StatusPresensi
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    keterangan: Optional[str] = None
    sumber_pencatatan: Optional[str] = "manual_panel"

class PresensiGTKCreate(PresensiGTKBase):
    pass

class PresensiGTKResponse(PresensiGTKBase):
    id: str
    dicatat_oleh: Optional[str] = None
    tahun_ajaran_id: str
    created_at: str
    updated_at: str

class RekapPresensiGTKResponse(BaseModel):
    tanggal: date
    total_gtk: int
    hadir: int
    sakit: int
    izin: int
    alpha: int
    belum_dicatat: int
    detail: list[dict]
