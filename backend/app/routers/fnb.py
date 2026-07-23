import random
import string
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require, get_current_user
from pydantic import BaseModel

from ..models.fnb import FnbOrder, FnbOrderItem, FnbOutlet
from ..models.reservation import Reservation
from ..models.room import Room
from ..models.billing import FolioCharge
from ..models.user import User
from ..schemas.fnb import (
    FnbOrderCreate, FnbOrderUpdate, FnbOrderResponse,
    FnbSettleRequest, FnbChargeRoomRequest,
)
from ..services import billing_service

router = APIRouter(prefix="/fnb", tags=["F&B Orders"])

# Folio particulars that route revenue to the right department report.
_PARTICULAR = {"restaurant": "Restaurant", "bar": "Bar"}


def _order_no() -> str:
    return "FB" + "".join(random.choices(string.digits, k=6))


def _recalc(order: FnbOrder) -> None:
    order.subtotal = sum((i.unit_price * i.quantity for i in order.items), Decimal("0"))


def _apply_items(order: FnbOrder, items) -> None:
    order.items.clear()
    for it in items:
        order.items.append(FnbOrderItem(
            menu_item_id=it.menu_item_id,
            name=it.name,
            unit_price=it.unit_price,
            quantity=it.quantity,
            line_total=(it.unit_price * it.quantity),
        ))
    _recalc(order)


# ── Outlets ───────────────────────────────────────────────────────────────────
class OutletBody(BaseModel):
    name: str
    outlet_type: str = "restaurant"
    location: Optional[str] = None
    is_active: bool = True


@router.get("/outlets", dependencies=[Depends(require("fnb.outlets", "fnb.orders.view", "fnb.orders.manage"))])
def list_outlets(db: Session = Depends(get_db)):
    return db.query(FnbOutlet).order_by(FnbOutlet.name).all()


@router.post("/outlets", status_code=201, dependencies=[Depends(require("fnb.outlets"))])
def create_outlet(data: OutletBody, db: Session = Depends(get_db)):
    o = FnbOutlet(**data.model_dump())
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


@router.patch("/outlets/{outlet_id}", dependencies=[Depends(require("fnb.outlets"))])
def update_outlet(outlet_id: int, data: OutletBody, db: Session = Depends(get_db)):
    o = db.query(FnbOutlet).filter(FnbOutlet.id == outlet_id).first()
    if not o:
        raise HTTPException(404, "Outlet not found")
    for k, v in data.model_dump().items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return o


@router.delete("/outlets/{outlet_id}", status_code=204, dependencies=[Depends(require("fnb.outlets"))])
def delete_outlet(outlet_id: int, db: Session = Depends(get_db)):
    o = db.query(FnbOutlet).filter(FnbOutlet.id == outlet_id).first()
    if not o:
        raise HTTPException(404, "Outlet not found")
    db.delete(o)
    db.commit()


@router.get("/orders", response_model=List[FnbOrderResponse],
            dependencies=[Depends(require("fnb.orders.view", "fnb.orders.manage"))])
def list_orders(
    status: Optional[str] = None,
    outlet: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    q = db.query(FnbOrder)
    if status:
        q = q.filter(FnbOrder.status == status)
    if outlet:
        q = q.filter(FnbOrder.outlet == outlet)
    if date_from:
        q = q.filter(FnbOrder.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.filter(FnbOrder.created_at <= datetime.combine(date_to, datetime.max.time()))
    return q.order_by(FnbOrder.created_at.desc()).all()


@router.post("/orders", response_model=FnbOrderResponse, status_code=201,
             dependencies=[Depends(require("fnb.orders.manage"))])
def create_order(data: FnbOrderCreate, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    order = FnbOrder(
        order_number=_order_no(),
        outlet=data.outlet,
        table_label=data.table_label,
        room_number=data.room_number,
        reservation_id=data.reservation_id,
        notes=data.notes,
        status="open",
        created_by=current_user.full_name,
    )
    _apply_items(order, data.items)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.patch("/orders/{order_id}", response_model=FnbOrderResponse,
              dependencies=[Depends(require("fnb.orders.manage"))])
def update_order(order_id: int, data: FnbOrderUpdate, db: Session = Depends(get_db)):
    order = db.query(FnbOrder).filter(FnbOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "open":
        raise HTTPException(400, "Only open orders can be edited")
    for field in ("table_label", "room_number", "reservation_id", "notes"):
        val = getattr(data, field)
        if val is not None:
            setattr(order, field, val)
    if data.items is not None:
        _apply_items(order, data.items)
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/charge-to-room", response_model=FnbOrderResponse,
             dependencies=[Depends(require("fnb.orders.manage"))])
def charge_to_room(order_id: int, data: FnbChargeRoomRequest, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    order = db.query(FnbOrder).filter(FnbOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "open":
        raise HTTPException(400, "Order already closed")
    res = db.query(Reservation).filter(Reservation.id == data.reservation_id).first()
    if not res:
        raise HTTPException(404, "Reservation not found")
    if res.status != "checked_in":
        raise HTTPException(400, "Can only charge to a checked-in stay")
    room = db.query(Room).filter(Room.id == res.room_id).first()
    particular = _PARTICULAR.get(order.outlet, "Restaurant")
    desc = ", ".join(f"{i.quantity}× {i.name}" for i in order.items)[:500]
    charge = FolioCharge(
        reservation_id=res.id,
        ref_number="FB" + "".join(random.choices(string.digits, k=5)),
        date=date.today(),
        room_number=room.room_number if room else order.room_number,
        particular=particular,
        charge_type="extra",
        description=desc,
        amount=order.subtotal,
        posted_by=current_user.full_name,
    )
    db.add(charge)
    order.status = "charged"
    order.reservation_id = res.id
    order.room_number = charge.room_number
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/settle", response_model=FnbOrderResponse,
             dependencies=[Depends(require("fnb.orders.manage"))])
def settle_order(order_id: int, data: FnbSettleRequest, db: Session = Depends(get_db)):
    order = db.query(FnbOrder).filter(FnbOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "open":
        raise HTTPException(400, "Order already closed")
    order.status = "paid"
    order.payment_method = data.payment_method
    db.commit()
    db.refresh(order)
    return order


@router.delete("/orders/{order_id}", status_code=204,
               dependencies=[Depends(require("fnb.orders.manage"))])
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(FnbOrder).filter(FnbOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "charged":
        raise HTTPException(400, "Charged orders are on a folio and cannot be deleted")
    db.delete(order)
    db.commit()
