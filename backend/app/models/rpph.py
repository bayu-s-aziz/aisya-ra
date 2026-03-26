from typing import Any

from pydantic import BaseModel


class RpphGenerateRequest(BaseModel):
    tema: str
    subtema: str
    kelompok: str
    hari: str


class RpphGenerateResponse(BaseModel):
    success: bool
    message: str
    data: dict[str, Any]


class RpphCreateRequest(BaseModel):
    kelompok_id: str
    tanggal: str
    tema: str
    subtema: str
    konten_json: dict[str, Any]
    pdf_url: str | None = None


class RpphUpdateRequest(BaseModel):
    kelompok_id: str | None = None
    tanggal: str | None = None
    tema: str | None = None
    subtema: str | None = None
    konten_json: dict[str, Any] | None = None
    pdf_url: str | None = None


class RpphItem(BaseModel):
    id: str
    guru_id: str
    kelompok_id: str
    tanggal: str
    tema: str
    subtema: str
    konten_json: dict[str, Any]
    pdf_url: str | None = None


class RpphDetailResponse(BaseModel):
    success: bool
    message: str
    data: RpphItem


class RpphListResponse(BaseModel):
    success: bool
    data: list[RpphItem]
