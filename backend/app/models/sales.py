from sqlalchemy import Column, Integer, String, Numeric, Text, Boolean, TIMESTAMP
from sqlalchemy.sql import func

from ..database import Base


class RatePackage(Base):
    """A sellable rate plan / package: a nightly price plus inclusions
    (breakfast, spa, late checkout…)."""
    __tablename__ = "rate_packages"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), nullable=False, unique=True, index=True)
    name_en = Column(String(150), nullable=False)
    name_fr = Column(String(150), nullable=False)
    description = Column(Text)
    base_price = Column(Numeric(10, 2), nullable=False, default=0)   # per night, XAF
    inclusions = Column(Text)          # JSON array of strings
    min_nights = Column(Integer, nullable=False, default=1)
    color = Column(String(20), nullable=False, default="#3b5bdb")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class SalesAccount(Base):
    """A corporate client, travel agent or OTA with negotiated terms."""
    __tablename__ = "sales_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    account_type = Column(String(20), nullable=False, default="corporate")  # corporate | travel_agent | ota
    contact_name = Column(String(150))
    phone = Column(String(50))
    email = Column(String(150))
    commission_pct = Column(Numeric(5, 2), nullable=False, default=0)
    credit_limit = Column(Numeric(12, 2), nullable=False, default=0)
    payment_terms_days = Column(Integer, nullable=False, default=30)
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
