from sqlalchemy import Column, Integer, String, Numeric, Date, Text, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class FolioCharge(Base):
    """Individual charge posted to a reservation folio."""
    __tablename__ = "folio_charges"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=False)
    ref_number = Column(String(20), nullable=False, index=True)
    date = Column(Date, nullable=False)
    room_number = Column(String(10))
    particular = Column(String(100), nullable=False)  # display label: Room Rent, Gym, Min Bar, etc.
    charge_type = Column(String(20), index=True)  # stable classifier: room | extra | payment (see services.billing_service)
    description = Column(Text)
    amount = Column(Numeric(10, 2), nullable=False)
    posted_by = Column(String(100))
    is_void = Column(Boolean, default=False)
    is_posted = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    reservation = relationship("Reservation", back_populates="folio_charges")


class SpecialInstruction(Base):
    __tablename__ = "special_instructions"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=False)
    department = Column(String(50), nullable=False)  # HK, FO, F&B, etc.
    description = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    reservation = relationship("Reservation", back_populates="special_instructions")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(20), unique=True, nullable=False, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"))
    guest_id = Column(Integer, ForeignKey("guests.id"))
    status = Column(String(20), nullable=False, default="draft")  # draft, issued, paid, cancelled
    room_charges = Column(Numeric(10, 2), nullable=False, default=0)
    discount = Column(Numeric(10, 2), nullable=False, default=0)
    tax = Column(Numeric(10, 2), nullable=False, default=0)
    extra_charge = Column(Numeric(10, 2), nullable=False, default=0)
    unposted_inclusion = Column(Numeric(10, 2), nullable=False, default=0)
    amount_paid = Column(Numeric(10, 2), nullable=False, default=0)
    round_off = Column(Numeric(10, 2), nullable=False, default=0)
    total = Column(Numeric(10, 2), nullable=False, default=0)
    payment_type = Column(String(50))
    notes = Column(Text)
    issued_at = Column(TIMESTAMP)
    paid_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())

    reservation = relationship("Reservation", back_populates="invoices")
    guest = relationship("Guest", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    description = Column(String(255), nullable=False)
    item_type = Column(String(50), nullable=False)  # room_charge, service, tax, discount
    quantity = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)
    date = Column(Date)
    created_at = Column(TIMESTAMP, server_default=func.now())

    invoice = relationship("Invoice", back_populates="items")
