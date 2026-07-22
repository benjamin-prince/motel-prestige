from sqlalchemy import Column, Integer, String, Text, Date, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class LostFoundItem(Base):
    __tablename__ = "lost_found_items"

    id = Column(Integer, primary_key=True, index=True)
    item_description = Column(String(300), nullable=False)
    found_location = Column(String(200), nullable=True)
    found_date = Column(Date, nullable=False)
    found_by_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    guest_name = Column(String(200), nullable=True)
    guest_contact = Column(String(200), nullable=True)
    status = Column(String(20), nullable=False, default="found")  # found, claimed, donated, discarded
    storage_location = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    resolved_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    room = relationship("Room")
    found_by = relationship("User", foreign_keys=[found_by_staff_id])
