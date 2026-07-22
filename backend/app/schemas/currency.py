from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ── Currency ─────────────────────────────────────────────────────────────────

class CurrencyCreate(BaseModel):
    code: str
    name: str
    symbol: str
    xaf_rate: Decimal = Decimal("1")


class CurrencyUpdate(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    xaf_rate: Optional[Decimal] = None
    is_active: Optional[bool] = None


class CurrencyResponse(BaseModel):
    id: int
    code: str
    name: str
    symbol: str
    xaf_rate: Decimal
    is_default: bool
    is_active: bool
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConversionRequest(BaseModel):
    amount_xaf: Decimal
    target_currency: str


class ConversionResponse(BaseModel):
    amount_xaf: Decimal
    target_currency: str
    target_amount: Decimal
    xaf_rate: Decimal
    symbol: str


# ── Payment ──────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    reservation_id: int
    invoice_id: Optional[int] = None
    amount: Decimal = Field(gt=0)  # a payment is always a positive amount
    currency_code: str
    payment_method: str = "Cash"
    reference: Optional[str] = None
    note: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    reservation_id: int
    invoice_id: Optional[int] = None
    amount: Decimal
    currency_code: str
    xaf_equivalent: Decimal
    xaf_rate_snapshot: Decimal
    payment_method: str
    reference: Optional[str] = None
    note: Optional[str] = None
    paid_at: datetime

    model_config = {"from_attributes": True}


# ── Caisse (cash register) ────────────────────────────────────────────────────

class CaisseEntry(BaseModel):
    currency_code: str
    currency_name: str
    symbol: str
    total_amount: Decimal       # sum in that currency
    total_xaf: Decimal          # sum converted to XAF
    payment_count: int


class CaisseSummary(BaseModel):
    entries: List[CaisseEntry]
    grand_total_xaf: Decimal
