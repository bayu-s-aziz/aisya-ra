import csv
import re
from datetime import datetime
from io import StringIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.database import get_supabase_client
from app.models.auth import (
    LoginRequest,
    ManagedUserCreateRequest,
    ManagedUserUpdateRequest,
    RegisterGuruRequest,
    RegisterSchoolRequest,
    RegistrationStatusResponse,
    UpdateProfileRequest,
    UpdateRAProfileRequest,
)

router = APIRouter()
security = HTTPBearer()

MANAGE_USERS_ROLES = {"kepala_ra", "kepala", "admin", "admin_ra"}
ALLOWED_USER_ROLES = {"guru", "kepala_ra"}
MANAGED_USER_SELECT_FIELDS = (
    "id,nama,email,role,ra_id,telepon,jabatan,"
    "nik,nuptk,status_kepegawaian,nip,jenis_kelamin,tempat_lahir,tanggal_lahir,"
    "email_akun_madrasah_digital,tugas,mata_pelajaran,penempatan,total_jtm,created_at"
)

GTK_HEADER_ALIASES = {
    "nama": ["nama lengkap", "nama"],
    "nik": ["nik"],
    "nuptk": ["nuptk"],
    "status_kepegawaian": ["status kepegawaian"],
    "nip": ["nip"],
    "jenis_kelamin": ["jenis kelamin", "jk"],
    "tempat_lahir": ["tempat lahir"],
    "tanggal_lahir": ["tanggal lahir", "tgl lahir"],
    "telepon": ["nomor handphone", "no handphone", "nomor hp", "no hp", "telepon"],
    "email": ["email"],
    "email_akun_madrasah_digital": [
        "email akun madrasah digital",
        "email madrasah digital",
    ],
    "password_awal": ["password awal", "password"],
    "jabatan": ["jabatan"],
    "tugas": ["tugas"],
    "mata_pelajaran": ["mata pelajaran", "mapel"],
    "penempatan": ["penempatan"],
    "total_jtm": ["total jtm", "jtm"],
}

PROFILE_BASE_REQUIRED_FIELDS = {"id", "nama", "email", "role", "ra_id"}
ME_PROFILE_SELECT_FIELDS = "id,nama,email,role,ra_id,telepon,jabatan"
RA_PROFILE_SELECT_FIELDS = (
    "id,nama_ra,npsn,nomor_statistik,status_lembaga,bentuk_pendidikan,"
    "penyelenggara,akreditasi,sk_izin_operasional,tanggal_izin_operasional,"
    "nama_kepala,alamat,telepon,email_lembaga,website,kelurahan_desa,"
    "kecamatan,kabupaten_kota,provinsi,kode_pos,logo_url,tahun_ajaran"
)


def _extract_auth_user_id(auth_result) -> str:
    user = getattr(auth_result, "user", None)
    if user and getattr(user, "id", None):
        return user.id
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Gagal mendapatkan user id dari Supabase Auth",
    )


def _get_current_auth_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    supabase = get_supabase_client()
    access_token = credentials.credentials
    try:
        auth_response = supabase.auth.get_user(access_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kedaluwarsa",
        ) from exc

    user = getattr(auth_response, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User tidak ditemukan",
        )
    return user


def _normalize_header(value: str) -> str:
    lowered = (value or "").strip().lower()
    lowered = lowered.replace("_", " ")
    lowered = re.sub(r"\s+", " ", lowered)
    return lowered


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    if text.startswith("'"):
        text = text[1:].strip()

    return text or None


def _to_date_string(value: str | None) -> str | None:
    cleaned = _clean_text(value)
    if not cleaned:
        return None

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            parsed = datetime.strptime(cleaned, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return cleaned


def _extract_gtk_fields(raw_row: dict) -> dict:
    normalized_row = {
        _normalize_header(str(key)): _clean_text(value)
        for key, value in raw_row.items()
        if key is not None
    }

    mapped = {}
    for canonical_key, aliases in GTK_HEADER_ALIASES.items():
        value = None
        for alias in aliases:
            alias_normalized = _normalize_header(alias)
            candidate = normalized_row.get(alias_normalized)
            if candidate:
                value = candidate
                break
        mapped[canonical_key] = value

    return mapped


def _build_profile_payload(mapped: dict, role: str, ra_id: str, email: str, nama: str) -> dict:
    return {
        "nama": nama,
        "email": email,
        "role": role,
        "ra_id": ra_id,
        "telepon": mapped.get("telepon"),
        "jabatan": mapped.get("jabatan") or mapped.get("tugas"),
        "nik": mapped.get("nik"),
        "nuptk": mapped.get("nuptk"),
        "status_kepegawaian": mapped.get("status_kepegawaian"),
        "nip": mapped.get("nip"),
        "jenis_kelamin": mapped.get("jenis_kelamin"),
        "tempat_lahir": mapped.get("tempat_lahir"),
        "tanggal_lahir": _to_date_string(mapped.get("tanggal_lahir")),
        "email_akun_madrasah_digital": mapped.get("email_akun_madrasah_digital"),
        "tugas": mapped.get("tugas"),
        "mata_pelajaran": mapped.get("mata_pelajaran"),
        "penempatan": mapped.get("penempatan"),
        "total_jtm": mapped.get("total_jtm"),
    }


def _extract_missing_profiles_column(exc: Exception) -> str | None:
    message = str(exc)
    match = re.search(r"column\s+profiles\.([a-zA-Z0-9_]+)\s+does not exist", message)
    if match:
        return match.group(1)
    return None


def _select_profiles_with_fallback(query_factory, fields: str):
    selected_fields = [field.strip() for field in fields.split(",") if field.strip()]
    if not selected_fields:
        raise ValueError("Daftar field select profiles kosong")

    while selected_fields:
        try:
            response = query_factory(",".join(selected_fields)).execute()
            return response
        except Exception as exc:
            missing_column = _extract_missing_profiles_column(exc)
            if missing_column and missing_column in selected_fields:
                selected_fields = [item for item in selected_fields if item != missing_column]
                continue
            raise

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Tidak ada kolom profiles valid untuk dibaca",
    )


def _insert_profile_with_fallback(supabase, payload: dict):
    insert_payload = {key: value for key, value in payload.items() if value is not None}

    while insert_payload:
        try:
            response = supabase.table("pengguna").insert(insert_payload).execute()
            return response
        except Exception as exc:
            missing_column = _extract_missing_profiles_column(exc)
            if missing_column and missing_column in insert_payload and missing_column not in PROFILE_BASE_REQUIRED_FIELDS:
                insert_payload.pop(missing_column, None)
                continue
            raise

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Gagal membuat profil: payload kosong setelah filtering kolom tidak valid",
    )


def _update_profile_with_fallback(supabase, payload: dict, user_id: str, ra_id: str | None = None):
    update_payload = {key: value for key, value in payload.items() if value is not None}

    while update_payload:
        try:
            query = supabase.table("pengguna").update(update_payload).eq("id", user_id)
            if ra_id:
                query = query.eq("ra_id", ra_id)
            response = query.execute()
            return response
        except Exception as exc:
            missing_column = _extract_missing_profiles_column(exc)
            if missing_column and missing_column in update_payload and missing_column not in PROFILE_BASE_REQUIRED_FIELDS:
                update_payload.pop(missing_column, None)
                continue
            raise

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tidak ada kolom profil valid untuk diubah",
    )


def _get_manager_profile(supabase, current_user_id: str):
    try:
        profile_resp = (
            supabase.table("pengguna")
            .select("id,ra_id,role")
            .eq("id", current_user_id)
            .limit(1)
            .execute()
        )
        manager_profile = profile_resp.data[0] if profile_resp.data else None
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil profil user: {exc}",
        ) from exc

    if not manager_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil user tidak ditemukan",
        )

    role_lower = (manager_profile.get("role") or "").lower()
    if role_lower not in MANAGE_USERS_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Kepala RA / Admin yang dapat mengelola pengguna",
        )

    ra_id = manager_profile.get("ra_id")
    if not ra_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User tidak memiliki akses RA",
        )

    return manager_profile


@router.get("/registration-status", response_model=RegistrationStatusResponse)
def get_registration_status():
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("sekolah")
            .select("nama_ra")
            .limit(1)
            .execute()
        )
        has_ra = len(response.data) > 0
        ra_name = response.data[0]["nama_ra"] if has_ra else None
        return {"has_ra": has_ra, "ra_name": ra_name, "debug_v": 2}
    except Exception as e:
        print(f"DEBUG: get_registration_status error: {e}")
        return {"has_ra": False, "ra_name": None}


@router.post("/register-school", status_code=status.HTTP_201_CREATED)
def register_school(payload: RegisterSchoolRequest):
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_SERVICE_ROLE_KEY belum di-set. Endpoint register-school membutuhkan service role key.",
        )

    supabase = get_supabase_client()

    try:
        ra_insert_response = (
            supabase.table("sekolah")
            .insert(
                {
                    "nama_ra": payload.nama_ra,
                    "alamat": payload.alamat,
                    "nomor_statistik": payload.nomor_statistik,
                    "logo_url": payload.logo_url,
                    "tahun_ajaran": payload.tahun_ajaran,
                }
            )
            .execute()
        )
        ra_data = ra_insert_response.data[0]
        ra_id = ra_data["id"]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat data RA: {exc}",
        ) from exc

    try:
        auth_result = supabase.auth.admin.create_user(
            {
                "email": payload.admin.email,
                "password": payload.admin.password,
                "email_confirm": True,
                "user_metadata": {
                    "nama": payload.admin.nama,
                    "role": "kepala_ra",
                    "ra_id": ra_id,
                },
            }
        )
        auth_user_id = _extract_auth_user_id(auth_result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat user auth: {exc}",
        ) from exc

    try:
        supabase.table("pengguna").insert(
            {
                "id": auth_user_id,
                "nama": payload.admin.nama,
                "email": payload.admin.email,
                "role": "kepala_ra",
                "ra_id": ra_id,
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat profile admin: {exc}",
        ) from exc

    try:
        supabase.table("chat_ruang").insert(
            {
                "ra_id": ra_id,
                "tipe": "utama",
                "nama": "AISYA RA",
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat chat room default: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Registrasi RA dan Kepala RA berhasil",
        "data": {
            "ra_id": ra_id,
            "admin_id": auth_user_id,
        },
    }


@router.post("/register-guru", status_code=status.HTTP_201_CREATED)
def register_guru(payload: RegisterGuruRequest):
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_SERVICE_ROLE_KEY belum di-set.",
        )

    supabase = get_supabase_client()

    # 1. Get the existing school
    try:
        ra_response = supabase.table("sekolah").select("id").limit(1).execute()
        if not ra_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Belum ada RA terdaftar. Kepala RA harus mendaftar terlebih dahulu.",
            )
        ra_id = ra_response.data[0]["id"]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengecek data RA: {exc}",
        ) from exc

    # 2. Create Auth User
    try:
        auth_result = supabase.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "nama": payload.nama,
                    "role": "guru",
                    "ra_id": ra_id,
                },
            }
        )
        auth_user_id = _extract_auth_user_id(auth_result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat user auth: {exc}",
        ) from exc

    # 3. Create Profile
    try:
        supabase.table("pengguna").insert(
            {
                "id": auth_user_id,
                "nama": payload.nama,
                "email": payload.email,
                "role": "guru",
                "ra_id": ra_id,
            }
        ).execute()
    except Exception as exc:
        # Cleanup auth user if profile creation fails
        try:
            supabase.auth.admin.delete_user(auth_user_id)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat profil guru: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Registrasi Guru berhasil",
        "data": {
            "user_id": auth_user_id,
            "ra_id": ra_id,
        },
    }


@router.post("/login")
def login(payload: LoginRequest):
    supabase = get_supabase_client()
    try:
        auth_result = supabase.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Login gagal: {exc}",
        ) from exc

    session = getattr(auth_result, "session", None)
    user = getattr(auth_result, "user", None)
    if not session or not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login gagal: session atau user tidak ditemukan",
        )

    return {
        "success": True,
        "message": "Login berhasil",
        "data": {
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
            },
        },
    }


@router.post("/logout")
def logout(current_user=Depends(_get_current_auth_user)):
    supabase = get_supabase_client()
    try:
        supabase.auth.sign_out()
    except Exception:
        pass

    return {
        "success": True,
        "message": "Logout berhasil",
        "data": {"user_id": current_user.id},
    }


@router.get("/me")
def me(current_user=Depends(_get_current_auth_user)):
    supabase = get_supabase_client()
    profile = None
    ra_profile = None
    try:
        profile_response = _select_profiles_with_fallback(
            lambda fields: (
                supabase.table("pengguna")
                .select(fields)
                .eq("id", current_user.id)
                .limit(1)
            ),
            ME_PROFILE_SELECT_FIELDS,
        )
        if profile_response.data:
            profile = profile_response.data[0]

        if profile and profile.get("ra_id"):
            ra_response = (
                supabase.table("sekolah")
                .select(RA_PROFILE_SELECT_FIELDS)
                .eq("id", profile["ra_id"])
                .limit(1)
                .execute()
            )
            if ra_response.data:
                ra_profile = ra_response.data[0]
    except Exception:
        profile = None
        ra_profile = None

    return {
        "success": True,
        "data": {
            "auth_user": {
                "id": current_user.id,
                "email": current_user.email,
            },
            "profile": profile,
            "ra_profile": ra_profile,
        },
    }


@router.patch("/profile")
def update_profile(
    payload: UpdateProfileRequest,
    current_user=Depends(_get_current_auth_user),
):
    supabase = get_supabase_client()

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data yang diubah",
        )

    try:
        response = _update_profile_with_fallback(
            supabase,
            update_data,
            current_user.id,
        )
        updated = response.data[0] if response.data else None
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui profil: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Profil berhasil diperbarui",
        "data": {"profile": updated},
    }


@router.patch("/ra-profile")
def update_ra_profile(
    payload: UpdateRAProfileRequest,
    current_user=Depends(_get_current_auth_user),
):
    supabase = get_supabase_client()

    # Only kepala / admin may update RA profile
    try:
        profile_resp = (
            supabase.table("pengguna")
            .select("role,ra_id")
            .eq("id", current_user.id)
            .limit(1)
            .execute()
        )
        profile_row = profile_resp.data[0] if profile_resp.data else None
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memverifikasi role: {exc}",
        ) from exc

    if not profile_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan",
        )

    role_lower = (profile_row.get("role") or "").lower()
    if role_lower not in ("kepala_ra", "kepala", "admin", "admin_ra"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Kepala RA / Admin yang dapat memperbarui profil RA",
        )

    ra_id = profile_row.get("ra_id")
    if not ra_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RA tidak ditemukan untuk user ini",
        )

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data yang diubah",
        )

    try:
        response = (
            supabase.table("sekolah")
            .update(update_data)
            .eq("id", ra_id)
            .execute()
        )
        updated = response.data[0] if response.data else None
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui profil RA: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Profil RA berhasil diperbarui",
        "data": {"ra_profile": updated},
    }


@router.get("/users")
def list_managed_users(current_user=Depends(_get_current_auth_user)):
    supabase = get_supabase_client()
    manager_profile = _get_manager_profile(supabase, current_user.id)
    ra_id = manager_profile["ra_id"]

    try:
        response = _select_profiles_with_fallback(
            lambda fields: (
                supabase.table("pengguna")
                .select(fields)
                .eq("ra_id", ra_id)
                .order("nama")
            ),
            MANAGED_USER_SELECT_FIELDS,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar pengguna: {exc}",
        ) from exc

    return {
        "success": True,
        "data": response.data or [],
    }


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_managed_user(
    payload: ManagedUserCreateRequest,
    current_user=Depends(_get_current_auth_user),
):
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_SERVICE_ROLE_KEY belum di-set.",
        )

    supabase = get_supabase_client()
    manager_profile = _get_manager_profile(supabase, current_user.id)
    ra_id = manager_profile["ra_id"]
    role = (payload.role or "guru").lower()
    if role not in ALLOWED_USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role pengguna tidak valid",
        )

    try:
        auth_result = supabase.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "nama": payload.nama,
                    "role": role,
                    "ra_id": ra_id,
                },
            }
        )
        auth_user_id = _extract_auth_user_id(auth_result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat user auth: {exc}",
        ) from exc

    try:
        profile_insert = _insert_profile_with_fallback(
            supabase,
            {
                "id": auth_user_id,
                "nama": payload.nama,
                "email": payload.email,
                "role": role,
                "ra_id": ra_id,
                "telepon": payload.telepon,
                "jabatan": payload.jabatan,
                "nik": payload.nik,
                "nuptk": payload.nuptk,
                "status_kepegawaian": payload.status_kepegawaian,
                "nip": payload.nip,
                "jenis_kelamin": payload.jenis_kelamin,
                "tempat_lahir": payload.tempat_lahir,
                "tanggal_lahir": payload.tanggal_lahir,
                "email_akun_madrasah_digital": payload.email_akun_madrasah_digital,
                "tugas": payload.tugas,
                "mata_pelajaran": payload.mata_pelajaran,
                "penempatan": payload.penempatan,
                "total_jtm": payload.total_jtm,
            },
        )
        profile_data = profile_insert.data[0] if profile_insert.data else None
    except Exception as exc:
        try:
            supabase.auth.admin.delete_user(auth_user_id)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat profil pengguna: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Pengguna berhasil ditambahkan",
        "data": profile_data,
    }


@router.put("/users/{user_id}")
def update_managed_user(
    user_id: str,
    payload: ManagedUserUpdateRequest,
    current_user=Depends(_get_current_auth_user),
):
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_SERVICE_ROLE_KEY belum di-set.",
        )

    supabase = get_supabase_client()
    manager_profile = _get_manager_profile(supabase, current_user.id)
    ra_id = manager_profile["ra_id"]

    auth_update = {}
    if payload.email is not None:
        auth_update["email"] = payload.email
    if payload.password:
        auth_update["password"] = payload.password

    role = payload.role.lower() if payload.role else None
    if role and role not in ALLOWED_USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role pengguna tidak valid",
        )

    if auth_update:
        try:
            supabase.auth.admin.update_user_by_id(user_id, auth_update)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gagal memperbarui data auth pengguna: {exc}",
            ) from exc

    profile_updates = {}
    if payload.nama is not None:
        profile_updates["nama"] = payload.nama
    if payload.email is not None:
        profile_updates["email"] = payload.email
    if payload.telepon is not None:
        profile_updates["telepon"] = payload.telepon
    if payload.jabatan is not None:
        profile_updates["jabatan"] = payload.jabatan
    if payload.nik is not None:
        profile_updates["nik"] = payload.nik
    if payload.nuptk is not None:
        profile_updates["nuptk"] = payload.nuptk
    if payload.status_kepegawaian is not None:
        profile_updates["status_kepegawaian"] = payload.status_kepegawaian
    if payload.nip is not None:
        profile_updates["nip"] = payload.nip
    if payload.jenis_kelamin is not None:
        profile_updates["jenis_kelamin"] = payload.jenis_kelamin
    if payload.tempat_lahir is not None:
        profile_updates["tempat_lahir"] = payload.tempat_lahir
    if payload.tanggal_lahir is not None:
        profile_updates["tanggal_lahir"] = payload.tanggal_lahir
    if payload.email_akun_madrasah_digital is not None:
        profile_updates["email_akun_madrasah_digital"] = payload.email_akun_madrasah_digital
    if payload.tugas is not None:
        profile_updates["tugas"] = payload.tugas
    if payload.mata_pelajaran is not None:
        profile_updates["mata_pelajaran"] = payload.mata_pelajaran
    if payload.penempatan is not None:
        profile_updates["penempatan"] = payload.penempatan
    if payload.total_jtm is not None:
        profile_updates["total_jtm"] = payload.total_jtm
    if role is not None:
        profile_updates["role"] = role

    if not auth_update and not profile_updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data yang diubah",
        )

    try:
        if profile_updates:
            updated_profile = _update_profile_with_fallback(
                supabase,
                profile_updates,
                user_id,
                ra_id,
            )
        else:
            updated_profile = _select_profiles_with_fallback(
                lambda fields: (
                    supabase.table("pengguna")
                    .select(fields)
                    .eq("id", user_id)
                    .eq("ra_id", ra_id)
                    .limit(1)
                ),
                MANAGED_USER_SELECT_FIELDS,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memperbarui profil pengguna: {exc}",
        ) from exc

    if not updated_profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pengguna tidak ditemukan",
        )

    return {
        "success": True,
        "message": "Pengguna berhasil diperbarui",
        "data": updated_profile.data[0],
    }


@router.delete("/users/{user_id}")
def delete_managed_user(
    user_id: str,
    current_user=Depends(_get_current_auth_user),
):
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_SERVICE_ROLE_KEY belum di-set.",
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Akun sendiri tidak dapat dihapus",
        )

    supabase = get_supabase_client()
    manager_profile = _get_manager_profile(supabase, current_user.id)
    ra_id = manager_profile["ra_id"]

    try:
        target_profile = (
            supabase.table("pengguna")
            .select("id")
            .eq("id", user_id)
            .eq("ra_id", ra_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memverifikasi pengguna: {exc}",
        ) from exc

    if not target_profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pengguna tidak ditemukan",
        )

    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus pengguna auth: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Pengguna berhasil dihapus",
        "data": {"id": user_id},
    }


@router.post("/users/import-gtk")
async def import_managed_users_from_gtk(
    file: UploadFile = File(...),
    current_user=Depends(_get_current_auth_user),
):
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_SERVICE_ROLE_KEY belum di-set.",
        )

    supabase = get_supabase_client()
    manager_profile = _get_manager_profile(supabase, current_user.id)
    ra_id = manager_profile["ra_id"]

    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format file tidak didukung. Gunakan CSV",
        )

    content = await file.read()
    try:
        text_stream = StringIO(content.decode("utf-8-sig"))
        reader = csv.DictReader(text_stream)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membaca CSV GTK: {exc}",
        ) from exc

    imported_count = 0
    updated_count = 0
    skipped_count = 0
    errors: list[str] = []

    for row_index, row in enumerate(reader, start=2):
        mapped = _extract_gtk_fields(row)
        nama = mapped.get("nama")
        if not nama:
            skipped_count += 1
            continue

        email = mapped.get("email_akun_madrasah_digital") or mapped.get("email")
        if not email:
            skipped_count += 1
            errors.append(f"Baris {row_index}: email tidak ditemukan")
            continue

        password = mapped.get("password_awal") or "Guru123!"
        role = "guru"
        profile_payload = _build_profile_payload(mapped, role, ra_id, email, nama)

        try:
            existing_profile = (
                supabase.table("pengguna")
                .select("id")
                .eq("ra_id", ra_id)
                .eq("email", email)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            errors.append(f"Baris {row_index}: gagal cek user existing ({exc})")
            skipped_count += 1
            continue

        if existing_profile.data:
            existing_id = existing_profile.data[0]["id"]
            try:
                _update_profile_with_fallback(supabase, profile_payload, existing_id, ra_id)
                updated_count += 1
            except Exception as exc:
                errors.append(f"Baris {row_index}: gagal update profil ({exc})")
                skipped_count += 1
            continue

        auth_user_id = None
        try:
            auth_result = supabase.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "nama": nama,
                        "role": role,
                        "ra_id": ra_id,
                    },
                }
            )
            auth_user_id = _extract_auth_user_id(auth_result)
            _insert_profile_with_fallback(supabase, {"id": auth_user_id, **profile_payload})
            imported_count += 1
        except Exception as exc:
            if auth_user_id:
                try:
                    supabase.auth.admin.delete_user(auth_user_id)
                except Exception:
                    pass
            errors.append(f"Baris {row_index}: gagal import ({exc})")
            skipped_count += 1

    if imported_count == 0 and updated_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data guru valid untuk diimpor",
        )

    message = (
        f"Import guru selesai. Ditambahkan: {imported_count}, diperbarui: {updated_count}, dilewati: {skipped_count}."
    )
    if errors:
        message = f"{message} Contoh error: {'; '.join(errors[:3])}"

    return {
        "success": True,
        "message": message,
        "imported_count": imported_count,
        "updated_count": updated_count,
        "skipped_count": skipped_count,
    }
