from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SummaryCreate(BaseModel):
    source_url: Optional[str] = None
    source_text: Optional[str] = None
    user_instruction: Optional[str] = None
    title: Optional[str] = None
    mode: Optional[str] = None
    result: Optional[str] = None


class SummaryUpdate(BaseModel):
    result: str
    title: Optional[str] = None


class SummaryResponse(BaseModel):
    id: int
    title: str
    source_url: Optional[str]
    source_text: Optional[str]
    user_instruction: Optional[str]
    result: str
    mode: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
