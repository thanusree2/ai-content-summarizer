from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    source_url = Column(String, nullable=True)
    source_text = Column(Text, nullable=True)
    user_instruction = Column(Text, nullable=True)
    result = Column(Text, nullable=False)
    mode = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="summaries")
