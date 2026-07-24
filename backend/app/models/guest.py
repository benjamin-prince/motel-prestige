from sqlalchemy import Column, Integer, String, Date, Text, TIMESTAMP, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    id_type = Column(String(50))  # passport, national_id, driver_license
    id_number = Column(String(100))
    id_expiry_date = Column(Date)
    nationality = Column(String(100))
    country_of_residence = Column(String(100))
    date_of_birth = Column(Date)
    address = Column(Text)
    referred_by = Column(String(200))
    notes = Column(Text)

    # ── CRM / loyalty ──────────────────────────────────────────────────────
    vip = Column(Boolean, nullable=False, default=False)
    loyalty_tier = Column(String(20), nullable=False, default="standard")  # standard|silver|gold|platinum
    loyalty_points = Column(Integer, nullable=False, default=0)
    tags = Column(Text)  # comma-separated labels (e.g. "corporate,repeat,honeymoon")
    marketing_opt_in = Column(Boolean, nullable=False, default=False)
    # stay preferences (surfaced to front desk on the profile)
    preferred_room_type = Column(String(50))
    bed_preference = Column(String(50))       # e.g. king, twin, double
    smoking_preference = Column(String(10))   # no | yes
    dietary = Column(String(200))
    preferences = Column(Text)                # freeform extra preferences

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    reservations = relationship("Reservation", back_populates="guest")
    key_cards = relationship("KeyCard", back_populates="guest")
    invoices = relationship("Invoice", back_populates="guest")
