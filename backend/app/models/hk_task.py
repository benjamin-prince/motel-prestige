from sqlalchemy import Column, Integer, String, Text, Date, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class HKTask(Base):
    __tablename__ = "hk_tasks"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    task_type = Column(String(30), nullable=False, default="cleaning")  # cleaning, turndown, deep_clean, inspection
    priority = Column(String(20), nullable=False, default="normal")      # normal, priority, urgent
    status = Column(String(20), nullable=False, default="pending")       # pending, in_progress, done, skipped
    scheduled_date = Column(Date, nullable=False, server_default=func.current_date())
    notes = Column(Text, nullable=True)
    started_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    room = relationship("Room")
    assignee = relationship("User", foreign_keys=[assigned_to])
