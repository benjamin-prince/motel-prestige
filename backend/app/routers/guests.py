from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..dependencies import require
from ..models.guest import Guest
from ..schemas.guest import GuestCreate, GuestUpdate, GuestResponse
from ..services.crud import get_or_404, apply_updates

router = APIRouter(prefix="/guests", tags=["Guests"])


@router.get("/", response_model=List[GuestResponse], dependencies=[Depends(require("guests.view"))])
def list_guests(search: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Guest)
    if search:
        q = q.filter(
            (Guest.first_name.ilike(f"%{search}%")) |
            (Guest.last_name.ilike(f"%{search}%")) |
            (Guest.email.ilike(f"%{search}%")) |
            (Guest.phone.ilike(f"%{search}%"))
        )
    return q.order_by(Guest.last_name, Guest.first_name).all()


@router.post("/", response_model=GuestResponse, status_code=201, dependencies=[Depends(require("guests.create"))])
def create_guest(data: GuestCreate, db: Session = Depends(get_db)):
    if db.query(Guest).filter(Guest.email == data.email).first():
        raise HTTPException(400, "Email already registered")
    guest = Guest(**data.model_dump())
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


@router.get("/{guest_id}", response_model=GuestResponse, dependencies=[Depends(require("guests.view"))])
def get_guest(guest_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Guest, id=guest_id)


@router.patch("/{guest_id}", response_model=GuestResponse, dependencies=[Depends(require("guests.edit"))])
def update_guest(guest_id: int, data: GuestUpdate, db: Session = Depends(get_db)):
    guest = get_or_404(db, Guest, id=guest_id)
    apply_updates(guest, data.model_dump(exclude_none=True))
    db.commit()
    db.refresh(guest)
    return guest


@router.delete("/{guest_id}", status_code=204, dependencies=[Depends(require("guests.delete"))])
def delete_guest(guest_id: int, db: Session = Depends(get_db)):
    guest = get_or_404(db, Guest, id=guest_id)
    db.delete(guest)
    db.commit()
