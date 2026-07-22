"""Billing domain service.

Owns folio + invoice business logic and persistence so the billing router stays
a thin HTTP adapter. Two halves:

  * Pure classification — the single source of truth for what a folio charge
    *counts as*. Billing math used to key off the display string
    ``particular == "Room Rent"``, which breaks the moment that label is renamed
    (folio particulars are user-editable) or stored in French. Charges now carry
    a stable ``charge_type``; this module is the only place that interprets it.
  * Orchestration — query/create folio charges, settle payments, run the night
    audit, and build invoices.
"""
import random
import string
from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.billing import FolioCharge, Invoice
from ..models.reservation import Reservation
from ..models.room import Room
from ..schemas.billing import (
    FolioChargeCreate, FolioSettleRequest, FolioSummary, InvoiceCreate,
)

# ── Charge classification ────────────────────────────────────────────────────

# Canonical charge categories — stored in FolioCharge.charge_type.
CHARGE_ROOM = "room"          # room rent (counts toward room_charges)
CHARGE_EXTRA = "extra"        # any other billable item: outlet, service, minibar…
CHARGE_PAYMENT = "payment"    # a settlement posted against the folio (negative amount)
CHARGE_DISCOUNT = "discount"  # a price reduction (lowers the balance)
CHARGE_TAX = "tax"            # a tax line (raises the balance)

# Display label used for room rent before charge_type existed. Kept solely to
# classify historical rows whose charge_type is NULL.
_LEGACY_ROOM_PARTICULAR = "Room Rent"


def classify_charge(charge) -> str:
    """Return the canonical category of a folio charge, independent of its label.

    New rows carry an explicit ``charge_type``. Rows created before that column
    existed (``charge_type`` is NULL) fall back to amount sign and the legacy
    "Room Rent" label.
    """
    ct = getattr(charge, "charge_type", None)
    if ct in (CHARGE_ROOM, CHARGE_PAYMENT, CHARGE_DISCOUNT, CHARGE_TAX):
        return ct
    if ct:  # any other explicit value (e.g. "outlet", "service") is an extra
        return CHARGE_EXTRA

    # Legacy fallback — charge_type not set on this row.
    if Decimal(str(charge.amount)) < 0:
        return CHARGE_PAYMENT
    if charge.particular == _LEGACY_ROOM_PARTICULAR:
        return CHARGE_ROOM
    return CHARGE_EXTRA


# ── Helpers ──────────────────────────────────────────────────────────────────

def _ref(prefix: str) -> str:
    return prefix + "".join(random.choices(string.digits, k=5))


def _unique_invoice_number(db: Session) -> str:
    while True:
        number = "INV" + "".join(random.choices(string.digits, k=8))
        if not db.query(Invoice).filter(Invoice.invoice_number == number).first():
            return number


# ── Folio aggregation ────────────────────────────────────────────────────────

@dataclass
class FolioTotals:
    room_charges: Decimal  # positive room-rent charges
    extra: Decimal         # positive non-room charges
    discount: Decimal      # price reductions (lower the balance)
    tax: Decimal           # tax lines (raise the balance)
    amount_paid: Decimal   # booking advance + every folio settlement
    balance: Decimal       # room + extra + tax - discount - amount_paid


def summarize_folio(db: Session, reservation_id: int) -> FolioTotals:
    """Aggregate a reservation's folio into the canonical money breakdown.

    Single source of truth so every figure means the same thing everywhere.
    Each non-void line is bucketed by ``classify_charge``:

      * room / extra — positive charges that make up the gross bill
      * tax          — added on top of the bill
      * discount     — subtracted from the bill
      * payment      — money received; added to amount_paid alongside the
                       booking advance

    ``amount_paid`` is the booking advance plus every folio settlement.
    """
    charges = (
        db.query(FolioCharge)
        .filter(FolioCharge.reservation_id == reservation_id, FolioCharge.is_void == False)
        .all()
    )
    room = extra = discount = tax = folio_payments = Decimal(0)
    advance_on_folio = False  # booking advance already posted as a folio row
    for c in charges:
        amount = Decimal(str(c.amount))
        kind = classify_charge(c)
        if kind == CHARGE_PAYMENT:
            folio_payments += abs(amount)
            if c.posted_by == "Booking":
                advance_on_folio = True
        elif kind == CHARGE_DISCOUNT:
            discount += abs(amount)
        elif kind == CHARGE_TAX:
            tax += abs(amount)
        elif kind == CHARGE_ROOM:
            if amount > 0:
                room += amount
        elif amount > 0:  # extra
            extra += amount

    res = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    # The booking advance is posted to the folio as a payment row since
    # bookings bill the folio up front — only fall back to the reservation
    # field for legacy stays that predate that change (never count both).
    advance = Decimal(0) if advance_on_folio else (Decimal(str(res.advance_amount or 0)) if res else Decimal(0))
    amount_paid = advance + folio_payments
    return FolioTotals(
        room_charges=room,
        extra=extra,
        discount=discount,
        tax=tax,
        amount_paid=amount_paid,
        balance=room + extra + tax - discount - amount_paid,
    )


# ── Folio charges ────────────────────────────────────────────────────────────

def list_folio(
    db: Session,
    reservation_id: int,
    hide_void: bool = False,
    hide_unposted: bool = False,
) -> List[FolioCharge]:
    q = db.query(FolioCharge).filter(FolioCharge.reservation_id == reservation_id)
    if hide_void:
        q = q.filter(FolioCharge.is_void == False)
    if hide_unposted:
        q = q.filter(FolioCharge.is_posted == True)
    return q.order_by(FolioCharge.date, FolioCharge.id).all()


def add_charge(db: Session, data: FolioChargeCreate) -> FolioCharge:
    payload = data.model_dump()
    # Manual charges are extras unless the caller classified them otherwise.
    payload["charge_type"] = payload.get("charge_type") or CHARGE_EXTRA
    charge = FolioCharge(**payload, ref_number=_ref("R"))
    db.add(charge)
    db.commit()
    db.refresh(charge)
    return charge


def void_charge(db: Session, charge_id: int) -> FolioCharge:
    charge = db.query(FolioCharge).filter(FolioCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(404, "Charge not found")
    charge.is_void = True
    db.commit()
    db.refresh(charge)
    return charge


def get_folio_summary(db: Session, reservation_id: int) -> FolioSummary:
    t = summarize_folio(db, reservation_id)
    return FolioSummary(
        room_charges=t.room_charges,
        discount=t.discount,
        tax=t.tax,
        extra_charge=t.extra,
        unposted_inclusion=Decimal(0),
        amount_paid=t.amount_paid,
        round_off=Decimal(0),
        total=t.balance,
    )


def settle_folio(db: Session, data: FolioSettleRequest) -> FolioCharge:
    """Post a payment against a folio (reduces balance)."""
    charge = FolioCharge(
        reservation_id=data.reservation_id,
        ref_number=_ref("PAY"),
        date=date.today(),
        particular=data.particular,
        charge_type=CHARGE_PAYMENT,
        description=data.description,
        amount=-data.amount,  # negative = payment
        posted_by="system",
        is_posted=True,
    )
    db.add(charge)
    db.commit()
    db.refresh(charge)
    return charge


def post_booking_room_charge(db: Session, res: Reservation, room: Room) -> None:
    """Post the full-stay room rent (and any advance) at booking time, so the
    folio shows the real balance before check-in and payment can be collected
    up front. The night audit skips stays already billed this way.

    Short Stay (2h) bookings bill the room's 2h rate instead of nights."""
    if not room:
        return
    if res.rate_plan == "SS":
        amount = Decimal(str(room.price_short_stay or 0))
        description = "Room Rent — Short Stay (2h)"
    else:
        nights = res.nights or 0
        if nights <= 0:
            return
        amount = Decimal(str(room.price_per_night)) * nights
        description = f"Room Rent — {nights} night(s) booked stay"
    if amount <= 0:
        return
    db.add(FolioCharge(
        reservation_id=res.id,
        ref_number=_ref("R"),
        date=date.today(),
        room_number=room.room_number,
        particular="Room Rent",
        charge_type=CHARGE_ROOM,
        description=description,
        amount=amount,
        posted_by="Booking",
        is_posted=True,
    ))
    db.commit()


def post_payment_to_folio(db: Session, reservation_id: int, amount: Decimal,
                          method: str, posted_by: str = "Front Desk",
                          particular: str = "Payment",
                          description: Optional[str] = None) -> None:
    """Echo a cash-register payment into the folio so both ledgers agree."""
    res = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    room = db.query(Room).filter(Room.id == res.room_id).first() if res else None
    db.add(FolioCharge(
        reservation_id=reservation_id,
        ref_number=_ref("P"),
        date=date.today(),
        room_number=room.room_number if room else None,
        particular=particular,
        charge_type=CHARGE_PAYMENT,
        description=description or f"{method} payment",
        amount=-Decimal(str(amount)),
        posted_by=posted_by,
        is_posted=True,
    ))
    db.commit()


# ── Night audit ──────────────────────────────────────────────────────────────

def list_pending_checkouts(db: Session, audit_date: Optional[date] = None) -> List[dict]:
    today = audit_date or date.today()
    reservations = (
        db.query(Reservation)
        .filter(Reservation.check_out_date <= today, Reservation.status == "checked_in")
        .all()
    )
    return [
        {
            "id": r.id,
            "reservation_number": r.reservation_number,
            "guest_id": r.guest_id,
            "room_id": r.room_id,
            "check_out_date": r.check_out_date,
        }
        for r in reservations
    ]


def post_nightly_room_charges(db: Session, audit_date: Optional[date] = None) -> dict:
    """Post room rent charges for all checked-in reservations. Short Stay
    (2h) bookings are billed at their 2h rate when booked — never nightly."""
    today = audit_date or date.today()
    reservations = (
        db.query(Reservation)
        .filter(Reservation.status == "checked_in", Reservation.rate_plan != "SS")
        .all()
    )
    posted = []
    for res in reservations:
        room = db.query(Room).filter(Room.id == res.room_id).first()
        if not room:
            continue
        # Stay already billed in full at booking — don't double-charge.
        prepaid = (
            db.query(FolioCharge)
            .filter(
                FolioCharge.reservation_id == res.id,
                FolioCharge.charge_type == CHARGE_ROOM,
                FolioCharge.posted_by == "Booking",
                FolioCharge.is_void == False,
            )
            .first()
        )
        if prepaid:
            continue
        charge = FolioCharge(
            reservation_id=res.id,
            ref_number=_ref("R"),
            date=today,
            room_number=room.room_number,
            particular="Room Rent",
            charge_type=CHARGE_ROOM,
            description=f"Room Rent for {today}",
            amount=room.price_per_night,
            posted_by="Night Audit",
            is_posted=True,
        )
        db.add(charge)
        posted.append(res.reservation_number)
    db.commit()
    return {"posted_for": posted, "date": str(today)}


# ── Invoices ─────────────────────────────────────────────────────────────────

def list_invoices(db: Session, reservation_id: Optional[int] = None) -> List[Invoice]:
    q = db.query(Invoice)
    if reservation_id:
        q = q.filter(Invoice.reservation_id == reservation_id)
    return q.order_by(Invoice.created_at.desc()).all()


def create_invoice(db: Session, data: InvoiceCreate) -> Invoice:
    t = summarize_folio(db, data.reservation_id)
    invoice = Invoice(
        invoice_number=_unique_invoice_number(db),
        reservation_id=data.reservation_id,
        guest_id=data.guest_id,
        status="issued",
        room_charges=t.room_charges,
        discount=t.discount,
        tax=t.tax,
        extra_charge=t.extra,
        amount_paid=t.amount_paid,
        total=t.balance,
        payment_type=data.payment_type,
        notes=data.notes,
        issued_at=datetime.now(),
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
