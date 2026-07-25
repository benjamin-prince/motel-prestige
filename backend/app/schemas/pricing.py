from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class PricingRuleBase(BaseModel):
    name: str
    rule_type: str                       # occupancy | season | weekday
    room_type: Optional[str] = None      # None = all
    adjust_type: str = "percent"         # percent | fixed
    adjust_value: Decimal = Decimal("0")
    occupancy_min: Optional[int] = Field(default=None, ge=0, le=100)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    weekdays: Optional[str] = None       # "4,5"
    priority: int = 100
    is_active: bool = True


class PricingRuleCreate(PricingRuleBase):
    pass


class PricingRuleUpdate(BaseModel):
    name: Optional[str] = None
    rule_type: Optional[str] = None
    room_type: Optional[str] = None
    adjust_type: Optional[str] = None
    adjust_value: Optional[Decimal] = None
    occupancy_min: Optional[int] = Field(default=None, ge=0, le=100)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    weekdays: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class PricingRuleResponse(PricingRuleBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
