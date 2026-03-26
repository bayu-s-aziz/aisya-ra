from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class NotifikasiBase(BaseModel):
    judul: str
    pesan: str

class NotifikasiCreate(NotifikasiBase):
    user_id: str

class NotifikasiUpdate(BaseModel):
    dibaca: Optional[bool] = None

class NotifikasiResponse(NotifikasiBase):
    id: str
    user_id: str
    dibaca: bool
    created_at: datetime
