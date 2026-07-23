from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.hr import StaffShift, PayrollRecord
from ..models.user import User
from ..schemas.hr import (
    StaffShiftCreate, StaffShiftUpdate, StaffShiftResponse,
    PayrollCreate, PayrollUpdate, PayrollResponse,
)

router = APIRouter(prefix="/hr", tags=["HR"])


def _name(db: Session, user_id: int) -> Optional[str]:
    u = db.query(User).filter(User.id == user_id).first()
    return u.full_name if u else None


# ── Shifts ────────────────────────────────────────────────────────────────────
@router.get("/shifts", response_model=List[StaffShiftResponse],
            dependencies=[Depends(require("hrm.schedules", "hrm.staff.view"))])
def list_shifts(date_from: Optional[str] = None, date_to: Optional[str] = None,
                user_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(StaffShift)
    if date_from:
        q = q.filter(StaffShift.shift_date >= date_from)
    if date_to:
        q = q.filter(StaffShift.shift_date <= date_to)
    if user_id:
        q = q.filter(StaffShift.user_id == user_id)
    shifts = q.order_by(StaffShift.shift_date, StaffShift.start_time).all()
    out = []
    for s in shifts:
        r = StaffShiftResponse.model_validate(s)
        r.staff_name = _name(db, s.user_id)
        out.append(r)
    return out


@router.post("/shifts", response_model=StaffShiftResponse, status_code=201,
             dependencies=[Depends(require("hrm.schedules"))])
def create_shift(data: StaffShiftCreate, db: Session = Depends(get_db)):
    shift = StaffShift(**data.model_dump())
    db.add(shift)
    db.commit()
    db.refresh(shift)
    r = StaffShiftResponse.model_validate(shift)
    r.staff_name = _name(db, shift.user_id)
    return r


@router.patch("/shifts/{shift_id}", response_model=StaffShiftResponse,
              dependencies=[Depends(require("hrm.schedules"))])
def update_shift(shift_id: int, data: StaffShiftUpdate, db: Session = Depends(get_db)):
    shift = db.query(StaffShift).filter(StaffShift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, "Shift not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(shift, k, v)
    db.commit()
    db.refresh(shift)
    r = StaffShiftResponse.model_validate(shift)
    r.staff_name = _name(db, shift.user_id)
    return r


@router.delete("/shifts/{shift_id}", status_code=204,
               dependencies=[Depends(require("hrm.schedules"))])
def delete_shift(shift_id: int, db: Session = Depends(get_db)):
    shift = db.query(StaffShift).filter(StaffShift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, "Shift not found")
    db.delete(shift)
    db.commit()


# ── Payroll ───────────────────────────────────────────────────────────────────
def _finalize(rec: PayrollRecord) -> None:
    rec.net_pay = (Decimal(rec.base_salary) + Decimal(rec.allowances) - Decimal(rec.deductions))


@router.get("/payroll", response_model=List[PayrollResponse],
            dependencies=[Depends(require("hrm.payroll"))])
def list_payroll(period: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(PayrollRecord)
    if period:
        q = q.filter(PayrollRecord.period == period)
    recs = q.order_by(PayrollRecord.period.desc(), PayrollRecord.id).all()
    out = []
    for rec in recs:
        r = PayrollResponse.model_validate(rec)
        r.staff_name = _name(db, rec.user_id)
        out.append(r)
    return out


@router.post("/payroll", response_model=PayrollResponse, status_code=201,
             dependencies=[Depends(require("hrm.payroll"))])
def create_payroll(data: PayrollCreate, db: Session = Depends(get_db)):
    existing = db.query(PayrollRecord).filter(
        PayrollRecord.user_id == data.user_id, PayrollRecord.period == data.period).first()
    if existing:
        raise HTTPException(409, "A payslip already exists for this staff member and period")
    rec = PayrollRecord(**data.model_dump())
    _finalize(rec)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    r = PayrollResponse.model_validate(rec)
    r.staff_name = _name(db, rec.user_id)
    return r


@router.patch("/payroll/{rec_id}", response_model=PayrollResponse,
              dependencies=[Depends(require("hrm.payroll"))])
def update_payroll(rec_id: int, data: PayrollUpdate, db: Session = Depends(get_db)):
    rec = db.query(PayrollRecord).filter(PayrollRecord.id == rec_id).first()
    if not rec:
        raise HTTPException(404, "Payslip not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(rec, k, v)
    _finalize(rec)
    db.commit()
    db.refresh(rec)
    r = PayrollResponse.model_validate(rec)
    r.staff_name = _name(db, rec.user_id)
    return r


@router.delete("/payroll/{rec_id}", status_code=204,
               dependencies=[Depends(require("hrm.payroll"))])
def delete_payroll(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(PayrollRecord).filter(PayrollRecord.id == rec_id).first()
    if not rec:
        raise HTTPException(404, "Payslip not found")
    db.delete(rec)
    db.commit()
