from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..dependencies import require
from ..models.config import Property
from ..models.reservation import Reservation
from ..models.room import Room
from ..schemas.room import RoomCreate, RoomUpdate, RoomResponse
from ..services.crud import get_or_404, apply_updates

router = APIRouter(prefix="/rooms", tags=["Rooms"])


def _validate_floor(db: Session, floor: int) -> None:
    """A room's floor must exist in the site's building layout (Settings → Sites).

    Skipped when no site exists or its floor range was never configured (0..0),
    so sites set up before the layout feature keep working.
    """
    prop = db.query(Property).filter(Property.is_default == True).first()
    if not prop:
        return
    lo, hi = prop.floor_min or 0, prop.floor_max or 0
    if (lo, hi) == (0, 0):
        return
    if not (lo <= floor <= hi):
        raise HTTPException(400, f"Floor {floor} is outside the site layout ({lo} to {hi})")


@router.get("/", response_model=List[RoomResponse], dependencies=[Depends(require("fo.rooms.view", "fo.rooms.status", "hk.room_status", "maint.view", "kc.view"))])
def list_rooms(
    status: Optional[str] = None,
    floor: Optional[int] = None,
    room_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Room)
    if status:
        q = q.filter(Room.status == status)
    if floor is not None:
        q = q.filter(Room.floor == floor)
    if room_type:
        q = q.filter(Room.room_type == room_type)
    return q.order_by(Room.room_number).all()


def _validate_stay_offer(stay_offer: str, price_per_night, price_short_stay) -> None:
    """A room must carry a price for every stay type it is sold as."""
    if stay_offer not in ("OS", "SS", "BOTH"):
        raise HTTPException(400, "stay_offer must be OS, SS or BOTH")
    if stay_offer in ("OS", "BOTH") and float(price_per_night or 0) <= 0:
        raise HTTPException(400, "A nightly rate is required for rooms sold as nuitée")
    if stay_offer in ("SS", "BOTH") and float(price_short_stay or 0) <= 0:
        raise HTTPException(400, "A 2h rate is required for rooms sold as Short Stay")


@router.post("/", response_model=RoomResponse, status_code=201, dependencies=[Depends(require("fo.rooms.create"))])
def create_room(data: RoomCreate, db: Session = Depends(get_db)):
    if db.query(Room).filter(Room.room_number == data.room_number).first():
        raise HTTPException(400, "Room number already exists")
    _validate_floor(db, data.floor)
    _validate_stay_offer(data.stay_offer, data.price_per_night, data.price_short_stay)
    room = Room(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


# NOTE: must be declared before /{room_id} so "available" isn't parsed as an id.
@router.get("/available", response_model=List[RoomResponse], dependencies=[Depends(require("fo.rooms.view", "fo.res.view", "fo.res.create"))])
def list_available_rooms(
    check_in: date,
    check_out: date,
    starts_at: Optional[datetime] = None,  # Short Stay (2h): exact time window
    ends_at: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Rooms bookable for the given stay: not under maintenance and with no
    confirmed/in-house reservation whose occupancy window overlaps.

    Overnight (nuitée): pass dates, plus starts_at for the declared check-in
    time (otherwise 18:00 is assumed). Short Stay (2h): pass both starts_at
    and ends_at — only rooms with a 2h rate are returned.
    """
    from ..services.reservation_service import stay_interval, find_conflicting_reservation

    short_stay = bool(starts_at and ends_at)
    if short_stay:
        if ends_at <= starts_at:
            raise HTTPException(400, "ends_at must be after starts_at")
    elif check_out <= check_in:
        raise HTTPException(400, "check_out must be after check_in")

    start, end = stay_interval(check_in, check_out, "SS" if short_stay else "OS", starts_at, ends_at)
    q = db.query(Room).filter(Room.status != "maintenance")
    # Only offer rooms sold as this stay type (Gestion des Chambres setting).
    if short_stay:
        q = q.filter(Room.stay_offer.in_(["SS", "BOTH"]), Room.price_short_stay > 0)
    else:
        q = q.filter(Room.stay_offer.in_(["OS", "BOTH"]))
    return [
        room for room in q.order_by(Room.room_number).all()
        if not find_conflicting_reservation(db, room.id, start, end)
    ]


@router.get("/{room_id}", response_model=RoomResponse, dependencies=[Depends(require("fo.rooms.view", "fo.rooms.status", "hk.room_status", "maint.view", "kc.view"))])
def get_room(room_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Room, id=room_id)


@router.patch("/{room_id}", response_model=RoomResponse, dependencies=[Depends(require("fo.rooms.edit"))])
def update_room(room_id: int, data: RoomUpdate, db: Session = Depends(get_db)):
    room = get_or_404(db, Room, id=room_id)
    updates = data.model_dump(exclude_none=True)
    if "floor" in updates:
        _validate_floor(db, updates["floor"])
    if any(k in updates for k in ("stay_offer", "price_per_night", "price_short_stay")):
        _validate_stay_offer(
            updates.get("stay_offer", room.stay_offer or "OS"),
            updates.get("price_per_night", room.price_per_night),
            updates.get("price_short_stay", room.price_short_stay),
        )
    apply_updates(room, updates)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=204, dependencies=[Depends(require("fo.rooms.edit"))])
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = get_or_404(db, Room, id=room_id)
    db.delete(room)
    db.commit()
