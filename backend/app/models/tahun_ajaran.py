from typing import Optional

from pydantic import BaseModel


class TahunAjaranCreateRequest(BaseModel):
    label: str


class TahunAjaranItem(BaseModel):
    id: str
    ra_id: str
    label: str
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TahunAjaranListResponse(BaseModel):
    success: bool
    data: list[TahunAjaranItem]
    active_id: Optional[str] = None


class TahunAjaranDetailResponse(BaseModel):
    success: bool
    message: str
    data: TahunAjaranItem
