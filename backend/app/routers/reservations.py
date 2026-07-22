from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..schemas.reservation import ReservationCreate, ReservationUpdate, ReservationResponse
from ..services import reservation_service

router = APIRouter(prefix="/reservations", tags=["Reservations"])


@router.get("/", response_model=List[ReservationResponse], dependencies=[Depends(require("fo.res.view"))])
def list_reservations(
    status: Optional[str] = None,
    check_in_date: Optional[date] = None,
    guest_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    return reservation_service.list_reservations(db, status, check_in_date, guest_id)


@router.post("/", response_model=ReservationResponse, status_code=201, dependencies=[Depends(require("fo.res.create"))])
def create_reservation(data: ReservationCreate, db: Session = Depends(get_db)):
    return reservation_service.create_reservation(db, data)


@router.get("/{res_id}", response_model=ReservationResponse, dependencies=[Depends(require("fo.res.view"))])
def get_reservation(res_id: int, db: Session = Depends(get_db)):
    return reservation_service.get_reservation(db, res_id)


@router.patch("/{res_id}", response_model=ReservationResponse, dependencies=[Depends(require("fo.res.edit"))])
def update_reservation(res_id: int, data: ReservationUpdate, db: Session = Depends(get_db)):
    return reservation_service.update_reservation(db, res_id, data)


@router.post("/{res_id}/check-in", response_model=ReservationResponse, dependencies=[Depends(require("fo.checkin"))])
def check_in(res_id: int, db: Session = Depends(get_db)):
    return reservation_service.check_in(db, res_id)


@router.post("/{res_id}/check-out", response_model=ReservationResponse, dependencies=[Depends(require("fo.checkout"))])
def check_out(res_id: int, db: Session = Depends(get_db)):
    return reservation_service.check_out(db, res_id)
