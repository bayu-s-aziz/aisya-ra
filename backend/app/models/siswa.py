from typing import Optional

from pydantic import BaseModel


class SiswaCreateRequest(BaseModel):
    nama: str
    kelompok_id: Optional[str] = None
    status_aktif: bool = True
    nis: Optional[str] = None
    nisn: Optional[str] = None
    nik: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    tingkat_rombel: Optional[str] = None
    umur_text: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    alamat: Optional[str] = None
    no_telepon: Optional[str] = None
    kebutuhan_khusus: Optional[str] = None
    disabilitas: Optional[str] = None
    nomor_kip_pip: Optional[str] = None
    nama_ayah_kandung: Optional[str] = None
    nama_ibu_kandung: Optional[str] = None
    nama_wali: Optional[str] = None


class SiswaUpdateRequest(BaseModel):
    nama: Optional[str] = None
    kelompok_id: Optional[str] = None
    status_aktif: Optional[bool] = None
    nis: Optional[str] = None
    nisn: Optional[str] = None
    nik: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    tingkat_rombel: Optional[str] = None
    umur_text: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    alamat: Optional[str] = None
    no_telepon: Optional[str] = None
    kebutuhan_khusus: Optional[str] = None
    disabilitas: Optional[str] = None
    nomor_kip_pip: Optional[str] = None
    nama_ayah_kandung: Optional[str] = None
    nama_ibu_kandung: Optional[str] = None
    nama_wali: Optional[str] = None


class SiswaItem(BaseModel):
    id: str
    ra_id: str
    tahun_ajaran_id: Optional[str] = None
    nama: str
    kelompok_id: Optional[str]
    status_aktif: bool
    nis: Optional[str] = None
    nisn: Optional[str] = None
    nik: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    tingkat_rombel: Optional[str] = None
    umur_text: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    alamat: Optional[str] = None
    no_telepon: Optional[str] = None
    kebutuhan_khusus: Optional[str] = None
    disabilitas: Optional[str] = None
    nomor_kip_pip: Optional[str] = None
    nama_ayah_kandung: Optional[str] = None
    nama_ibu_kandung: Optional[str] = None
    nama_wali: Optional[str] = None


class SiswaListResponse(BaseModel):
    success: bool
    data: list[SiswaItem]


class SiswaDetailResponse(BaseModel):
    success: bool
    message: str
    data: SiswaItem


class SiswaImportResponse(BaseModel):
    success: bool
    message: str
    imported_count: int
