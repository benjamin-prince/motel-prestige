#!/usr/bin/env python3
"""
Creates or resets the super admin account.

Usage:
    python seed_admin.py

Environment variables (optional — falls back to defaults):
    ADMIN_EMAIL     default: admin@motel-prestige.com
    ADMIN_PASSWORD  default: Admin@1234
    ADMIN_NAME      default: Super Admin
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.services.auth_service import hash_password
import app.models  # noqa: F401 — register all models so create_all sees them

Base.metadata.create_all(bind=engine)

email = os.getenv("ADMIN_EMAIL", "admin@motel-prestige.com").lower().strip()
password = os.getenv("ADMIN_PASSWORD", "Admin@1234")
full_name = os.getenv("ADMIN_NAME", "Super Admin")

db = SessionLocal()
try:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        # Update password in case this is a reset
        existing.password_hash = hash_password(password)
        existing.role = "superadmin"
        existing.is_active = True
        db.commit()
        print(f"Super admin updated: {email}")
    else:
        db.add(User(email=email, full_name=full_name,
                    password_hash=hash_password(password),
                    role="superadmin", is_active=True))
        db.commit()
        print(f"Super admin created: {email}")
    print(f"Password: {password}")
finally:
    db.close()
