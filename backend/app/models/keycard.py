from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class KeyCard(Base):
    __tablename__ = "key_cards"

    id = Column(Integer, primary_key=True, index=True)
    card_number = Column(String(50), unique=True, nullable=False, index=True)
    card_uid = Column(String(100), unique=True)  # physical RFID UID
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to_name = Column(String(200), nullable=True)
    card_type = Column(String(20), nullable=False, default="guest")  # guest, staff, housekeeping, maintenance, master
    status = Column(String(20), nullable=False, default="active")  # active, inactive, lost, expired
    issued_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    valid_from = Column(TIMESTAMP, nullable=False, server_default=func.now())  # access window start, e.g. day-use 14:00
    expires_at = Column(TIMESTAMP, nullable=False)  # access window end, e.g. day-use 17:00
    deactivated_at = Column(TIMESTAMP)
    access_count = Column(Integer, nullable=False, default=0)
    access_zones = Column(Text, nullable=True)       # JSON: ["floor_1","pool","gym"] for zone-based cards
    notes = Column(Text, nullable=True)              # admin notes
    encoded_data = Column(JSONB)
    created_at = Column(TIMESTAMP, server_default=func.now())

    reservation = relationship("Reservation", back_populates="key_cards")
    guest = relationship("Guest", back_populates="key_cards")
    room = relationship("Room", back_populates="key_cards")
    access_logs = relationship("KeyCardAccessLog", back_populates="card")


class KeyCardAccessLog(Base):
    __tablename__ = "key_card_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("key_cards.id"), nullable=False)
    door_location = Column(String(100), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    accessed_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    access_granted = Column(Boolean, nullable=False)
    denial_reason = Column(String(100))
    reader_id = Column(String(50))

    card = relationship("KeyCard", back_populates="access_logs")
