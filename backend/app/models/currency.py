from sqlalchemy import Column, Integer, String, Numeric, Boolean, TIMESTAMP, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Currency(Base):
    """Exchange rates are stored as: 1 unit of this currency = xaf_rate XAF."""
    __tablename__ = "currencies"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)   # XAF, USD, EUR, CNY
    name = Column(String(100), nullable=False)                            # CFA Franc BEAC
    symbol = Column(String(10), nullable=False)                           # FCFA, $, €, ¥
    xaf_rate = Column(Numeric(20, 6), nullable=False, default=1)          # 1 USD = 600 XAF → xaf_rate=600
    is_default = Column(Boolean, nullable=False, default=False)           # only XAF is True
    is_active = Column(Boolean, nullable=False, default=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    created_at = Column(TIMESTAMP, server_default=func.now())

    payments = relationship("Payment", back_populates="currency")


class Payment(Base):
    """
    A single payment transaction. Stores both the amount in the chosen currency
    and its XAF equivalent at the time of payment for caisse reconciliation.
    """
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))

    # Amount the guest actually paid, in the chosen currency
    amount = Column(Numeric(15, 2), nullable=False)
    currency_code = Column(String(10), ForeignKey("currencies.code"), nullable=False)

    # XAF equivalent at the time of payment (amount * xaf_rate)
    xaf_equivalent = Column(Numeric(15, 2), nullable=False)

    # Exchange rate snapshot so historical records stay accurate
    xaf_rate_snapshot = Column(Numeric(20, 6), nullable=False)

    payment_method = Column(String(50), nullable=False, default="Cash")  # Cash, Card, Transfer
    reference = Column(String(100))
    note = Column(Text)
    paid_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    created_by = Column(String(100))

    currency = relationship("Currency", back_populates="payments")
