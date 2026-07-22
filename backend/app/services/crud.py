"""Shared CRUD helpers used by all routers."""
from typing import Type, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

T = TypeVar("T")


def get_or_404(db: Session, model: Type[T], *, name: str | None = None, **filters) -> T:
    """Fetch a single row matching the given column filters or raise 404.

    Usage: get_or_404(db, Room, id=room_id) or get_or_404(db, Currency, code=code).
    """
    obj = db.query(model).filter_by(**filters).first()
    if not obj:
        raise HTTPException(404, f"{name or model.__name__} not found")
    return obj


def apply_updates(obj, data: dict) -> None:
    """Set each key/value from a partial-update payload onto the ORM object."""
    for field, value in data.items():
        setattr(obj, field, value)
