from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    location_description = Column(String(300), nullable=True)
    category = Column(String(30), nullable=False, default="general")   # plumbing, electrical, hvac, carpentry, furniture, general
    priority = Column(String(20), nullable=False, default="medium")    # low, medium, high, urgent
    status = Column(String(20), nullable=False, default="open")        # open, in_progress, on_hold, done, cancelled
    description = Column(Text, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    room = relationship("Room")
    assignee = relationship("User", foreign_keys=[assigned_to])
    reporter = relationship("User", foreign_keys=[reported_by])
