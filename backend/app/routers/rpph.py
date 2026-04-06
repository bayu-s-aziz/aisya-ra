import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.database import get_supabase_client
from app.models.rpph import (
    RpphCreateRequest,
    RpphDetailResponse,
    RpphGenerateRequest,
    RpphGenerateResponse,
    RpphListResponse,
    RpphUpdateRequest,
)
from app.utils.academic_year import get_active_academic_year
from app.utils.auth import get_current_user_profile
from app.utils.gemini import generate_response
from app.utils.pdf import generate_rpph_pdf

router = APIRouter()


def _build_rpph_prompt(payload: RpphGenerateRequest) -> str:
    return (
        "Buat RPPH lengkap dengan komponen sesuai standar RA dalam format JSON valid. "
        "Komponen minimal: identitas pembelajaran, tujuan, materi, media, langkah kegiatan "
        "(pembukaan, inti, penutup), asesmen, refleksi, dan kebutuhan khusus peserta didik. "
        "Gunakan bahasa Indonesia yang jelas untuk guru RA. "
        "Hanya keluarkan JSON object tanpa markdown. "
        f"Tema: {payload.tema}. "
        f"Subtema: {payload.subtema}. "
        f"Kelompok: {payload.kelompok}. "
        f"Hari: {payload.hari}."
    )


@router.post("/generate", response_model=RpphGenerateResponse)
def generate_rpph(payload: RpphGenerateRequest, current=Depends(get_current_user_profile)):
    _ = current
    prompt = _build_rpph_prompt(payload)

    try:
        gemini_output = generate_response(prompt)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal generate RPPH dengan Gemini: {exc}",
        ) from exc

    cleaned_output = gemini_output.strip()
    if cleaned_output.startswith("```"):
        cleaned_output = cleaned_output.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(cleaned_output)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Output Gemini bukan JSON valid: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "RPPH berhasil digenerate",
        "data": parsed,
    }


@router.post("", response_model=RpphDetailResponse, status_code=status.HTTP_201_CREATED)
def create_rpph(payload: RpphCreateRequest, current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    guru_id = current["profile"]["id"]
    ra_id = current["ra_id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=guru_id)
    tahun_ajaran_id = active_year["id"]

    try:
        kelompok_check = (
            supabase.table("kelompok")
            .select("id")
            .eq("id", payload.kelompok_id)
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memeriksa kelompok: {exc}",
        ) from exc

    if not kelompok_check.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="kelompok_id tidak valid untuk RA ini",
        )

    try:
        insert_response = (
            supabase.table("rpph")
            .insert(
                {
                    "guru_id": guru_id,
                    "kelompok_id": payload.kelompok_id,
                    "tahun_ajaran_id": tahun_ajaran_id,
                    "tanggal": payload.tanggal,
                    "tema": payload.tema,
                    "subtema": payload.subtema,
                    "konten_json": payload.konten_json,
                    "pdf_url": payload.pdf_url,
                }
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menyimpan RPPH: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "RPPH berhasil disimpan",
        "data": insert_response.data[0],
    }


@router.get("", response_model=RpphListResponse)
def list_rpph(current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    guru_id = current["profile"]["id"]
    ra_id = current["ra_id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=guru_id)
    tahun_ajaran_id = active_year["id"]

    try:
        response = (
            supabase.table("rpph")
            .select("id,guru_id,tahun_ajaran_id,kelompok_id,tanggal,tema,subtema,konten_json,pdf_url")
            .eq("guru_id", guru_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .order("tanggal", desc=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar RPPH: {exc}",
        ) from exc

    return {"success": True, "data": response.data or []}


@router.put("/{id}", response_model=RpphDetailResponse)
def update_rpph(id: str, payload: RpphUpdateRequest, current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    guru_id = current["profile"]["id"]
    ra_id = current["ra_id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=guru_id)
    tahun_ajaran_id = active_year["id"]

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data yang diubah",
        )

    kelompok_id = update_data.get("kelompok_id")
    if kelompok_id:
        try:
            kelompok_check = (
                supabase.table("kelompok")
                .select("id")
                .eq("id", kelompok_id)
                .eq("ra_id", ra_id)
                .eq("tahun_ajaran_id", tahun_ajaran_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gagal memeriksa kelompok: {exc}",
            ) from exc

        if not kelompok_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="kelompok_id tidak valid untuk RA ini",
            )

    try:
        update_response = (
            supabase.table("rpph")
            .update(update_data)
            .eq("id", id)
            .eq("guru_id", guru_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal mengubah RPPH: {exc}",
        ) from exc

    if not update_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RPPH tidak ditemukan",
        )

    return {
        "success": True,
        "message": "RPPH berhasil diubah",
        "data": update_response.data[0],
    }


@router.delete("/{id}")
def delete_rpph(id: str, current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    guru_id = current["profile"]["id"]
    ra_id = current["ra_id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=guru_id)
    tahun_ajaran_id = active_year["id"]

    try:
        delete_response = (
            supabase.table("rpph")
            .delete()
            .eq("id", id)
            .eq("guru_id", guru_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menghapus RPPH: {exc}",
        ) from exc

    if not delete_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RPPH tidak ditemukan",
        )

    return {
        "success": True,
        "message": "RPPH berhasil dihapus",
        "data": {"id": id},
    }


@router.get("/{id}/pdf")
def get_rpph_pdf(id: str, current=Depends(get_current_user_profile)):
    supabase = get_supabase_client()
    guru_id = current["profile"]["id"]
    ra_id = current["ra_id"]
    active_year = get_active_academic_year(supabase, ra_id, created_by=guru_id)
    tahun_ajaran_id = active_year["id"]

    try:
        response = (
            supabase.table("rpph")
            .select("id,konten_json")
            .eq("id", id)
            .eq("guru_id", guru_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data RPPH: {exc}",
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RPPH tidak ditemukan",
        )

    konten_json = response.data[0].get("konten_json") or {}
    try:
        pdf_bytes = generate_rpph_pdf(konten_json)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal generate PDF RPPH: {exc}",
        ) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="rpph-{id}.pdf"'},
    )
