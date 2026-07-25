from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, TIMESTAMP
from sqlalchemy.sql import func

from ..database import Base


class PricingRule(Base):
    """A dynamic-pricing rule that adjusts a room's base rate.

    Three kinds:
      occupancy — apply when forecast occupancy ≥ occupancy_min (yield pricing)
      season    — apply on dates in [date_from, date_to]
      weekday   — apply on the given weekdays (0=Mon … 6=Sun), e.g. weekend uplift
    """
    __tablename__ = "pricing_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    rule_type = Column(String(20), nullable=False)             # occupancy | season | weekday
    room_type = Column(String(50))                             # NULL = all room types
    adjust_type = Column(String(10), nullable=False, default="percent")  # percent | fixed
    adjust_value = Column(Numeric(10, 2), nullable=False, default=0)      # +15 (%) or +2000 (fixed)
    occupancy_min = Column(Integer)                            # occupancy rules: threshold %
    date_from = Column(Date)                                   # season rules
    date_to = Column(Date)
    weekdays = Column(String(20))                              # weekday rules: "4,5" (Fri,Sat)
    priority = Column(Integer, nullable=False, default=100)    # lower = applied first
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
