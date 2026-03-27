from typing import Optional

from pydantic import BaseModel


class CreateChatRoomRequest(BaseModel):
    nama: str
    tipe: str = 'custom'


class CreateChatRoomResponse(BaseModel):
    success: bool
    data: dict


class ChatRoomItem(BaseModel):
    id: str
    ra_id: str
    tipe: str
    nama: str


class ChatRoomListResponse(BaseModel):
    success: bool
    data: list[ChatRoomItem]


class DeleteChatRoomResponse(BaseModel):
    success: bool
    message: str


class ChatMessageItem(BaseModel):
    id: str
    user_id: str
    room_id: str
    role_msg: str
    content: str
    timestamp: str


class ChatMessagesResponse(BaseModel):
    success: bool
    data: list[ChatMessageItem]
    page: int
    limit: int
    total: int


class SendMessageRequest(BaseModel):
    content: str


class SendMessageResponse(BaseModel):
    success: bool
    message: str
    data: dict


class VoiceMessageResponse(BaseModel):
    success: bool
    message: str
    data: dict
    transcription: str
