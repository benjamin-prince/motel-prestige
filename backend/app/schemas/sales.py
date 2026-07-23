from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ── Rate Packages ─────────────────────────────────────────────────────────────
class RatePackageBase(BaseModel):
    code: str
    name_en: str
    name_fr: str
    description: Optional[str] = None
    base_price: Decimal = Field(ge=0)
    inclusions: Optional[str] = None      # JSON array string
    min_nights: int = Field(default=1, ge=1)
    color: str = "#3b5bdb"
    is_active: bool = True


class RatePackageCreate(RatePackageBase):
    pass


class RatePackageUpdate(BaseModel):
    code: Optional[str] = None
    name_en: Optional[str] = None
    name_fr: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[Decimal] = Field(default=None, ge=0)
    inclusions: Optional[str] = None
    min_nights: Optional[int] = Field(default=None, ge=1)
    color: Optional[str] = None
    is_active: Optional[bool] = None


class RatePackageResponse(RatePackageBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Sales Accounts (corporate / agents / OTA) ─────────────────────────────────
class SalesAccountBase(BaseModel):
    name: str
    account_type: str = "corporate"
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    commission_pct: Decimal = Field(default=0, ge=0, le=100)
    credit_limit: Decimal = Field(default=0, ge=0)
    payment_terms_days: int = Field(default=30, ge=0)
    notes: Optional[str] = None
    is_active: bool = True


class SalesAccountCreate(SalesAccountBase):
    pass


class SalesAccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    commission_pct: Optional[Decimal] = Field(default=None, ge=0, le=100)
    credit_limit: Optional[Decimal] = Field(default=None, ge=0)
    payment_terms_days: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class SalesAccountResponse(SalesAccountBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
