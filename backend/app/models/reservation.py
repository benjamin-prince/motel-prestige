from sqlalchemy import Column, Integer, String, Date, Numeric, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    reservation_number = Column(String(20), unique=True, nullable=False, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)

    # Stay
    check_in_date = Column(Date, nullable=False)
    check_out_date = Column(Date, nullable=False)
    actual_check_in = Column(TIMESTAMP)
    actual_check_out = Column(TIMESTAMP)
    nights = Column(Integer, nullable=False, default=1)
    release_date = Column(Date)

    # Pax
    adults = Column(Integer, nullable=False, default=1)
    children = Column(Integer, nullable=False, default=0)
    infants = Column(Integer, nullable=False, default=0)
    extra_bed = Column(Integer, nullable=False, default=0)

    # Status / type
    status = Column(String(20), nullable=False, default="confirmed")  # confirmed, checked_in, checked_out, cancelled, no_show
    resev_type = Column(String(50), default="Confirm Reservation")
    rate_plan = Column(String(10), nullable=False, default="OS")  # SS = Short Stay (hourly), OS = Overnight Stay
    stay_starts_at = Column(TIMESTAMP)  # precise window start, e.g. 14:00 — used by Short Stay bookings
    stay_ends_at = Column(TIMESTAMP)    # precise window end, e.g. 16:00
    guest_type = Column(String(20), default="FIT")  # FIT, GROUP, CORPORATE, WALK_IN

    # Arrival info
    arrival_mode = Column(String(50))   # By Air, By Road, By Sea
    arrival_flight = Column(String(20))
    arrival_time = Column(TIMESTAMP)
    departure_mode = Column(String(50))
    departure_flight = Column(String(20))
    departure_time = Column(TIMESTAMP)

    # Billing
    source_reference = Column(String(100))
    purpose = Column(String(100))
    bill_to = Column(String(50), default="Guest")
    payment_type = Column(String(50), default="Cash")
    payment_method = Column(String(50), default="Cash")
    advance_amount = Column(Numeric(10, 2), default=0)
    payment_note = Column(Text)
    valet_parking = Column(String(5), default="no")

    special_requests = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    guest = relationship("Guest", back_populates="reservations")
    room = relationship("Room", back_populates="reservations")
    key_cards = relationship("KeyCard", back_populates="reservation")
    invoices = relationship("Invoice", back_populates="reservation")
    folio_charges = relationship("FolioCharge", back_populates="reservation")
    special_instructions = relationship("SpecialInstruction", back_populates="reservation", cascade="all, delete-orphan")
