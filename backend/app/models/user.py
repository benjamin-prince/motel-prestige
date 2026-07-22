from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP, Text, Date
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    __tablename__ = "users"

    # ── Core (required) ───────────────────────────────────────────────────────
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="staff")
    is_active = Column(Boolean, default=True, nullable=False)

    # ── Personal profile ──────────────────────────────────────────────────────
    avatar_url = Column(Text, nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    nationality = Column(String(100), nullable=True)

    # ── Identity document ─────────────────────────────────────────────────────
    id_type = Column(String(50), nullable=True)
    id_number = Column(String(100), nullable=True)

    # ── Address ───────────────────────────────────────────────────────────────
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)

    # ── HR / Employment ───────────────────────────────────────────────────────
    employee_id = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    hire_date = Column(Date, nullable=True)

    # ── Emergency contact ─────────────────────────────────────────────────────
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)

    # ── Notes ─────────────────────────────────────────────────────────────────
    notes = Column(Text, nullable=True)

    # ── Security ──────────────────────────────────────────────────────────────
    must_change_password = Column(Boolean, default=True, nullable=False)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
