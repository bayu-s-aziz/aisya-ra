from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase_client
from app.models.kelompok import (
    KelompokCreateRequest,
    KelompokDetailResponse,
    KelompokListResponse,
    KelompokUpdateRequest,
)
from app.utils.auth import get_current_user_profile

router = APIRouter()


@router.get("", response_model=KelompokListResponse)
def list_kelompok(current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    try:
        response = (
            supabase.table("kelompok")
            .select(
                "id,ra_id,nama_kelompok,wali_kelas_id,"
                "kode_rombel,tingkat,semester,kurikulum,ruang_kelas,kapasitas,status_rombel"
            )
            .eq("ra_id", ra_id)
            .order("nama_kelompok")
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data kelompok: {exc}",
        ) from exc

    return {"success": True, "data": response.data or []}


@router.post("", response_model=KelompokDetailResponse, status_code=status.HTTP_201_CREATED)
def create_kelompok(payload: KelompokCreateRequest, current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    try:
        response = (
            supabase.table("kelompok")
            .insert(
                {
                    "ra_id": ra_id,
                    "nama_kelompok": payload.nama_kelompok,
                    "wali_kelas_id": payload.wali_kelas_id,
                    "kode_rombel": payload.kode_rombel,
                    "tingkat": payload.tingkat,
                    "semester": payload.semester,
                    "kurikulum": payload.kurikulum,
                    "ruang_kelas": payload.ruang_kelas,
                    "kapasitas": payload.kapasitas,
                    "status_rombel": payload.status_rombel,
                }
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menambah kelompok: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Kelompok berhasil ditambahkan",
        "data": response.data[0],
    }


@router.put("/{id}", response_model=KelompokDetailResponse)
def update_kelompok(id: str, payload: KelompokUpdateRequest, current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data yang diubah",
        )

    try:
        response = (
            supabase.table("kelompok")
            .update(update_data)
            .eq("id", id)
            .eq("ra_id", ra_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal mengubah kelompok: {exc}",
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kelompok tidak ditemukan",
        )

    return {
        "success": True,
        "message": "Kelompok berhasil diubah",
        "data": response.data[0],
    }


@router.delete("/{id}")
def delete_kelompok(id: str, current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    ra_id = current["ra_id"]

    try:
        siswa_response = (
            supabase.table("siswa")
            .select("id")
            .eq("ra_id", ra_id)
            .eq("kelompok_id", id)
            .eq("status_aktif", True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memeriksa data siswa: {exc}",
        ) from exc

    if siswa_response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kelompok tidak dapat dihapus karena masih memiliki siswa aktif",
        )

    try:
        delete_response = (
            supabase.table("kelompok")
            .delete()
            .eq("id", id)
            .eq("ra_id", ra_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus kelompok: {exc}",
        ) from exc

    if not delete_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kelompok tidak ditemukan",
        )

    return {
        "success": True,
        "message": "Kelompok berhasil dihapus",
        "data": {"id": id},
    }
