from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal


# ── Store items ──────────────────────────────────────────────────────────────

class StoreItemCreate(BaseModel):
    name_en: str
    name_fr: str
    category: str = "general"
    unit: str = "pcs"
    quantity: Decimal = Decimal(0)
    reorder_level: Decimal = Decimal(0)
    unit_price: Decimal = Decimal(0)


class StoreItemUpdate(BaseModel):
    name_en: Optional[str] = None
    name_fr: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    reorder_level: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    is_active: Optional[bool] = None


class StoreItemResponse(BaseModel):
    id: int
    name_en: str
    name_fr: str
    category: str
    unit: str
    quantity: Decimal
    reorder_level: Decimal
    unit_price: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Stock movements ──────────────────────────────────────────────────────────

class StockAdjustRequest(BaseModel):
    change: Decimal  # positive = stock in, negative = stock out
    reason: str = "adjustment"  # purchase, adjustment, damage
    note: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: int
    item_id: int
    change: Decimal
    reason: str
    ref: Optional[str] = None
    note: Optional[str] = None
    posted_by: Optional[str] = None
    created_at: datetime
    item_name_en: Optional[str] = None
    item_name_fr: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Requisitions ─────────────────────────────────────────────────────────────

class RequisitionItemIn(BaseModel):
    item_id: int
    quantity: Decimal = Field(gt=0)


class RequisitionCreate(BaseModel):
    department: str
    note: Optional[str] = None
    items: List[RequisitionItemIn] = Field(min_length=1)


class RequisitionDecision(BaseModel):
    note: Optional[str] = None


class RequisitionItemResponse(BaseModel):
    id: int
    item_id: int
    quantity: Decimal
    name_en: Optional[str] = None
    name_fr: Optional[str] = None
    unit: Optional[str] = None
    in_stock: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class RequisitionResponse(BaseModel):
    id: int
    req_number: str
    department: str
    status: str
    note: Optional[str] = None
    requested_by: Optional[str] = None
    decided_by: Optional[str] = None
    decision_note: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    items: List[RequisitionItemResponse] = []

    model_config = {"from_attributes": True}
