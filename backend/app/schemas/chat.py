from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ChatMessage(BaseModel):
    q: str
    a: str


class ChatSave(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    id: int
    summary_id: int
    messages: list[ChatMessage]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
