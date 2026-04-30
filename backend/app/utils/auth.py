from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import get_supabase_client

security = HTTPBearer()


def get_current_auth_user(
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


def get_current_user_profile(current_user=Depends(get_current_auth_user)):
    supabase = get_supabase_client()
    try:
        profile_response = (
            supabase.table("pengguna")
            .select("id,nama,email,role,ra_id,jabatan")
            .eq("id", current_user.id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil profile user: {exc}",
        ) from exc

    if not profile_response.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profile user tidak ditemukan",
        )

    profile = profile_response.data[0]
    ra_id = profile.get("ra_id")
    if not ra_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User tidak memiliki akses RA",
        )

    return {
        "auth_user": current_user,
        "profile": profile,
        "ra_id": ra_id,
    }
