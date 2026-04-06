from pydantic import BaseModel
from datetime import date
from enum import Enum
from typing import Optional

class StatusPresensi(str, Enum):
    hadir = "hadir"
    sakit = "sakit"
    izin = "izin"
    alpha = "alpha"


class ModeRekapPresensi(str, Enum):
    harian = "harian"
    mingguan = "mingguan"
    bulanan = "bulanan"

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
    keterangan: Optional[str] = None
    sumber_pencatatan: Optional[str] = None

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


class RekapPresensiPeriodeSummary(BaseModel):
    total_hari: int
    total_slot_presensi: int
    hadir: int
    sakit: int
    izin: int
    alpha: int
    belum_dicatat: int
    persentase_hadir: float


class RekapPresensiPeriodeHarian(BaseModel):
    tanggal: date
    hadir: int
    sakit: int
    izin: int
    alpha: int
    belum_dicatat: int


class RekapPresensiPeriodeStatusTanggal(BaseModel):
    tanggal: date
    status: str


class RekapPresensiPeriodeSiswa(BaseModel):
    siswa_id: str
    nama: str
    hadir: int
    sakit: int
    izin: int
    alpha: int
    belum_dicatat: int
    persentase_hadir: float
    status_per_tanggal: list[RekapPresensiPeriodeStatusTanggal]


class RekapPresensiPeriodeResponse(BaseModel):
    mode: ModeRekapPresensi
    kelompok_id: str
    kelompok_nama: str
    tanggal_acuan: date
    tanggal_mulai: date
    tanggal_selesai: date
    total_siswa: int
    summary: RekapPresensiPeriodeSummary
    detail_harian: list[RekapPresensiPeriodeHarian]
    detail_siswa: list[RekapPresensiPeriodeSiswa]


class PresensiBatchItem(BaseModel):
    siswa_id: str
    status: StatusPresensi
    keterangan: Optional[str] = None
    sumber_pencatatan: Optional[str] = None


class PresensiBatchUpsertRequest(BaseModel):
    tanggal: date
    kelompok_id: str
    records: list[PresensiBatchItem]


class PresensiBatchUpsertResponse(BaseModel):
    success: bool
    message: str
    inserted: int
    updated: int
