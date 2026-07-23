from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


# ── Shifts ────────────────────────────────────────────────────────────────────
class StaffShiftBase(BaseModel):
    user_id: int
    shift_date: date
    start_time: str = "08:00"
    end_time: str = "16:00"
    role_label: Optional[str] = None
    notes: Optional[str] = None


class StaffShiftCreate(StaffShiftBase):
    pass


class StaffShiftUpdate(BaseModel):
    shift_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    role_label: Optional[str] = None
    notes: Optional[str] = None


class StaffShiftResponse(StaffShiftBase):
    id: int
    staff_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Payroll ───────────────────────────────────────────────────────────────────
class PayrollBase(BaseModel):
    user_id: int
    period: str                                  # "YYYY-MM"
    base_salary: Decimal = Field(default=0, ge=0)
    allowances: Decimal = Field(default=0, ge=0)
    deductions: Decimal = Field(default=0, ge=0)
    status: str = "draft"
    notes: Optional[str] = None


class PayrollCreate(PayrollBase):
    pass


class PayrollUpdate(BaseModel):
    base_salary: Optional[Decimal] = Field(default=None, ge=0)
    allowances: Optional[Decimal] = Field(default=None, ge=0)
    deductions: Optional[Decimal] = Field(default=None, ge=0)
    status: Optional[str] = None
    notes: Optional[str] = None


class PayrollResponse(PayrollBase):
    id: int
    net_pay: Decimal
    staff_name: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
