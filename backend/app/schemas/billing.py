from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class FolioChargeCreate(BaseModel):
    reservation_id: int
    date: date
    room_number: Optional[str] = None
    particular: str
    charge_type: Optional[str] = None  # room | extra | payment; defaults to extra when omitted
    description: Optional[str] = None
    amount: Decimal
    posted_by: Optional[str] = None


class FolioChargeResponse(FolioChargeCreate):
    id: int
    ref_number: str
    is_void: bool
    is_posted: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FolioSettleRequest(BaseModel):
    reservation_id: int
    payment_type: str
    amount: Decimal
    particular: str
    description: Optional[str] = None


class FolioSummary(BaseModel):
    room_charges: Decimal
    discount: Decimal
    tax: Decimal
    extra_charge: Decimal
    unposted_inclusion: Decimal
    amount_paid: Decimal
    round_off: Decimal
    total: Decimal


class InvoiceCreate(BaseModel):
    reservation_id: int
    guest_id: int
    payment_type: Optional[str] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    reservation_id: Optional[int] = None
    guest_id: Optional[int] = None
    status: str
    room_charges: Decimal
    discount: Decimal
    tax: Decimal
    extra_charge: Decimal
    amount_paid: Decimal
    round_off: Decimal
    total: Decimal
    payment_type: Optional[str] = None
    issued_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
