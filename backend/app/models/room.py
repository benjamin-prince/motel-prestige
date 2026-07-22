from sqlalchemy import Column, Integer, String, Numeric, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(10), unique=True, nullable=False, index=True)
    room_type = Column(String(50), nullable=False)  # single, double, twin, suite, deluxe
    floor = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="available")      # available, occupied, maintenance, cleaning
    hk_status = Column(String(20), nullable=False, default="clean")       # dirty, cleaning, clean, inspected, do_not_disturb, out_of_order
    price_per_night = Column(Numeric(10, 2), nullable=False)
    price_short_stay = Column(Numeric(10, 2))  # 2h Short Stay rate
    stay_offer = Column(String(10), nullable=False, default="OS")  # OS = nuitée only, SS = 2h only, BOTH
    max_occupancy = Column(Integer, nullable=False, default=2)
    description = Column(Text)
    amenities = Column(JSONB, default=[])
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    reservations = relationship("Reservation", back_populates="room")
    key_cards = relationship("KeyCard", back_populates="room")
