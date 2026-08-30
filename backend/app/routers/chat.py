import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.summary import Summary
from app.models.chat import Chat
from app.schemas.chat import ChatSave, ChatResponse, ChatMessage
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.post("/{summary_id}", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
def save_chat(
    summary_id: int,
    payload: ChatSave,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == current_user.id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    messages_json = json.dumps([m.model_dump() for m in payload.messages])

    existing = db.query(Chat).filter(Chat.summary_id == summary_id, Chat.user_id == current_user.id).first()
    if existing:
        existing.messages = messages_json
        db.commit()
        db.refresh(existing)
        return ChatResponse(
            id=existing.id,
            summary_id=existing.summary_id,
            messages=payload.messages,
            created_at=existing.created_at,
            updated_at=existing.updated_at,
        )

    chat = Chat(
        summary_id=summary_id,
        user_id=current_user.id,
        messages=messages_json,
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return ChatResponse(
        id=chat.id,
        summary_id=chat.summary_id,
        messages=payload.messages,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )


@router.get("/{summary_id}", response_model=ChatResponse | None)
def load_chat(
    summary_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    chat = db.query(Chat).filter(Chat.summary_id == summary_id, Chat.user_id == current_user.id).first()
    if not chat:
        return None
    messages = [ChatMessage(**m) for m in json.loads(chat.messages)]
    return ChatResponse(
        id=chat.id,
        summary_id=chat.summary_id,
        messages=messages,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )
