from sqlalchemy import Column, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    summary_id = Column(Integer, ForeignKey("summaries.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    messages = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    summary = relationship("Summary", backref="chats")
    user = relationship("User")
