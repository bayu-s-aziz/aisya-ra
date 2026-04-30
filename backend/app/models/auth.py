from typing import Optional

from pydantic import BaseModel


class UpdateProfileRequest(BaseModel):
    nama: Optional[str] = None
    email: Optional[str] = None
    telepon: Optional[str] = None
    jabatan: Optional[str] = None


class UpdateRAProfileRequest(BaseModel):
    nama_ra: Optional[str] = None
    npsn: Optional[str] = None
    nomor_statistik: Optional[str] = None
    status_lembaga: Optional[str] = None
    bentuk_pendidikan: Optional[str] = None
    penyelenggara: Optional[str] = None
    akreditasi: Optional[str] = None
    sk_izin_operasional: Optional[str] = None
    tanggal_izin_operasional: Optional[str] = None
    nama_kepala: Optional[str] = None
    alamat: Optional[str] = None
    telepon: Optional[str] = None
    email_lembaga: Optional[str] = None
    website: Optional[str] = None
    kelurahan_desa: Optional[str] = None
    kecamatan: Optional[str] = None
    kabupaten_kota: Optional[str] = None
    provinsi: Optional[str] = None
    kode_pos: Optional[str] = None
    tahun_ajaran: Optional[str] = None
    logo_url: Optional[str] = None


class AdminRegisterRequest(BaseModel):
    nama: str
    email: str
    password: str


class RegisterSchoolRequest(BaseModel):
    nama_ra: str
    alamat: str
    nomor_statistik: str
    logo_url: Optional[str] = None
    tahun_ajaran: str
    admin: AdminRegisterRequest


class RegisterGuruRequest(BaseModel):
    nama: str
    email: str
    password: str


class RegistrationStatusResponse(BaseModel):
    has_ra: bool
    ra_name: Optional[str] = None
    debug_v: Optional[int] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ManagedUserCreateRequest(BaseModel):
    nama: str
    email: str
    password: str
    role: str = "guru"
    telepon: Optional[str] = None
    jabatan: Optional[str] = None
    nik: Optional[str] = None
    nuptk: Optional[str] = None
    status_kepegawaian: Optional[str] = None
    nip: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    email_akun_madrasah_digital: Optional[str] = None
    tugas: Optional[str] = None
    mata_pelajaran: Optional[str] = None
    penempatan: Optional[str] = None
    total_jtm: Optional[str] = None


class ManagedUserUpdateRequest(BaseModel):
    nama: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    telepon: Optional[str] = None
    jabatan: Optional[str] = None
    nik: Optional[str] = None
    nuptk: Optional[str] = None
    status_kepegawaian: Optional[str] = None
    nip: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    email_akun_madrasah_digital: Optional[str] = None
    tugas: Optional[str] = None
    mata_pelajaran: Optional[str] = None
    penempatan: Optional[str] = None
    total_jtm: Optional[str] = None
