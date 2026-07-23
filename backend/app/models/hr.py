from sqlalchemy import Column, Integer, String, Numeric, Text, Date, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func

from ..database import Base


class StaffShift(Base):
    """A scheduled work shift for a staff member."""
    __tablename__ = "staff_shifts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    shift_date = Column(Date, nullable=False, index=True)
    start_time = Column(String(5), nullable=False, default="08:00")  # HH:MM
    end_time = Column(String(5), nullable=False, default="16:00")
    role_label = Column(String(100))   # e.g. "Reception", "Housekeeping"
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())


class PayrollRecord(Base):
    """One payslip line for a staff member over a pay period."""
    __tablename__ = "payroll_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    period = Column(String(7), nullable=False, index=True)   # "YYYY-MM"
    base_salary = Column(Numeric(12, 2), nullable=False, default=0)
    allowances = Column(Numeric(12, 2), nullable=False, default=0)
    deductions = Column(Numeric(12, 2), nullable=False, default=0)
    net_pay = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="draft")  # draft | approved | paid
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
