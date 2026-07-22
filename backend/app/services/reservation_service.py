"""Reservation domain service.

Owns reservation lifecycle logic — creation/validation, the check-in/check-out
state machine and its room-status side effects, and activity logging — so the
reservations router stays a thin HTTP adapter.
"""
import random
import string
from datetime import datetime, date, time as dtime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models.reservation import Reservation
from ..models.room import Room
from ..models.guest import Guest
from ..models.billing import SpecialInstruction
from ..schemas.reservation import ReservationCreate, ReservationUpdate
from .activity_logger import log_activity


def _generate_res_number() -> str:
    return "".join(random.choices(string.digits, k=10))


def _guest_name(db: Session, guest_id: int) -> str:
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    return f"{guest.first_name} {guest.last_name}" if guest else f"Guest #{guest_id}"


def list_reservations(
    db: Session,
    status: Optional[str] = None,
    check_in_date: Optional[date] = None,
    guest_id: Optional[int] = None,
) -> List[Reservation]:
    q = db.query(Reservation).options(joinedload(Reservation.special_instructions))
    if status:
        q = q.filter(Reservation.status == status)
    if check_in_date:
        q = q.filter(Reservation.check_in_date == check_in_date)
    if guest_id:
        q = q.filter(Reservation.guest_id == guest_id)
    return q.order_by(Reservation.check_in_date.desc()).all()


def get_reservation(db: Session, res_id: int) -> Reservation:
    res = (
        db.query(Reservation)
        .options(joinedload(Reservation.special_instructions))
        .filter(Reservation.id == res_id)
        .first()
    )
    if not res:
        raise HTTPException(404, "Reservation not found")
    return res


def _require_adult_with_valid_id(db: Session, guest_id: int) -> None:
    """Booking policy: only adults (18+) with a valid, unexpired ID can book."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(404, "Guest not found")
    today = date.today()
    if not guest.date_of_birth:
        raise HTTPException(400, "Booking refused: guest date of birth is required (adults only).")
    age = today.year - guest.date_of_birth.year - (
        (today.month, today.day) < (guest.date_of_birth.month, guest.date_of_birth.day)
    )
    if age < 18:
        raise HTTPException(400, "Booking refused: guest must be at least 18 years old.")
    if not guest.id_type or not guest.id_number:
        raise HTTPException(400, "Booking refused: a valid guest ID (type and number) is required.")
    if guest.id_expiry_date and guest.id_expiry_date < today:
        raise HTTPException(400, f"Booking refused: guest ID expired on {guest.id_expiry_date.isoformat()}.")


# Overnight stays hold the room from evening check-in (18:00) on the arrival
# day to noon checkout on the departure day. The afternoon gap is deliberate:
# a 2h Short Stay can turn the room over before the night guest arrives, and
# a 2h stay can be sold right after a noon checkout.
_CHECKIN_TIME = dtime(18, 0)
_CHECKOUT_TIME = dtime(12, 0)


def stay_interval(check_in: date, check_out: date, rate_plan: str = "OS",
                  starts_at: Optional[datetime] = None,
                  ends_at: Optional[datetime] = None) -> tuple[datetime, datetime]:
    """Occupancy window of a stay. Short Stay (2h) holds its exact time
    window. Overnight stays start at their declared check-in time (so a room
    that frees up earlier that day can still be booked) — default 18:00 —
    and end at noon checkout."""
    if rate_plan == "SS" and starts_at and ends_at:
        return starts_at, ends_at
    start = starts_at or datetime.combine(check_in, _CHECKIN_TIME)
    return start, datetime.combine(check_out, _CHECKOUT_TIME)


def find_conflicting_reservation(db: Session, room_id: int, start: datetime,
                                 end: datetime,
                                 exclude_res_id: Optional[int] = None) -> Optional[Reservation]:
    """First confirmed/in-house reservation whose occupancy window overlaps
    [start, end) on this room, or None."""
    q = db.query(Reservation).filter(
        Reservation.room_id == room_id,
        Reservation.status.in_(["confirmed", "checked_in"]),
    )
    if exclude_res_id:
        q = q.filter(Reservation.id != exclude_res_id)
    for other in q.all():
        o_start, o_end = stay_interval(other.check_in_date, other.check_out_date,
                                       other.rate_plan, other.stay_starts_at, other.stay_ends_at)
        if start < o_end and end > o_start:
            return other
    return None


def _require_room_free(db: Session, room: Room, check_in, check_out,
                       rate_plan: str = "OS", starts_at=None, ends_at=None,
                       exclude_res_id: int = None) -> None:
    """Booking policy: a room can hold one stay at a time — refuse any
    reservation whose occupancy window overlaps a confirmed or in-house stay,
    or a stay type the room is not sold as."""
    if room.status == "maintenance":
        raise HTTPException(400, f"Room {room.room_number} is under maintenance and cannot be booked.")
    offer = room.stay_offer or "OS"
    if rate_plan == "SS" and offer == "OS":
        raise HTTPException(400, f"Room {room.room_number} is not offered for 2h stays (nuitée only).")
    if rate_plan != "SS" and offer == "SS":
        raise HTTPException(400, f"Room {room.room_number} is offered for 2h stays only.")
    start, end = stay_interval(check_in, check_out, rate_plan, starts_at, ends_at)
    conflict = find_conflicting_reservation(db, room.id, start, end, exclude_res_id)
    if conflict:
        if conflict.rate_plan == "SS" and conflict.stay_starts_at:
            window = f"{conflict.stay_starts_at:%Y-%m-%d %H:%M} to {conflict.stay_ends_at:%H:%M}"
        else:
            window = f"{conflict.check_in_date} to {conflict.check_out_date}"
        raise HTTPException(
            400,
            f"Room {room.room_number} is not available: reservation "
            f"{conflict.reservation_number} occupies it from {window}.",
        )


def create_reservation(db: Session, data: ReservationCreate) -> Reservation:
    room = db.query(Room).filter(Room.id == data.room_id).first()
    if not room:
        raise HTTPException(404, "Room not found")
    _require_adult_with_valid_id(db, data.guest_id)

    nights = (data.check_out_date - data.check_in_date).days
    if data.rate_plan == "SS":
        if not data.stay_starts_at or not data.stay_ends_at:
            raise HTTPException(400, "Short Stay bookings require stay_starts_at and stay_ends_at")
        if data.stay_ends_at <= data.stay_starts_at:
            raise HTTPException(400, "stay_ends_at must be after stay_starts_at")
    elif nights <= 0:
        raise HTTPException(400, "Check-out must be after check-in")

    _require_room_free(db, room, data.check_in_date, data.check_out_date,
                       data.rate_plan or "OS", data.stay_starts_at, data.stay_ends_at)

    res_number = data.reservation_number or _generate_res_number()
    while db.query(Reservation).filter(Reservation.reservation_number == res_number).first():
        res_number = _generate_res_number()

    instructions = data.special_instructions or []
    payload = data.model_dump(exclude={"reservation_number", "special_instructions"})
    payload["reservation_number"] = res_number
    payload["nights"] = nights

    reservation = Reservation(**payload)
    for inst in instructions:
        reservation.special_instructions.append(SpecialInstruction(**inst))

    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    # Bill the stay up front so the folio shows the real balance immediately
    # and payment can be collected before check-in.
    from . import billing_service
    billing_service.post_booking_room_charge(db, reservation, room)

    # An advance collected at booking is real money: record it in the cash
    # register AND echo it onto the folio so all ledgers agree.
    if reservation.advance_amount and float(reservation.advance_amount) > 0:
        from decimal import Decimal
        from ..models.currency import Payment
        amt = Decimal(str(reservation.advance_amount))
        method = reservation.payment_method or "Cash"
        db.add(Payment(
            reservation_id=reservation.id,
            amount=amt,
            currency_code="XAF",
            xaf_equivalent=amt,
            xaf_rate_snapshot=Decimal("1"),
            payment_method=method,
            note="Advance collected at booking",
        ))
        db.commit()
        billing_service.post_payment_to_folio(
            db, reservation.id, amt, method,
            posted_by="Booking", particular="Advance Payment",
            description="Advance collected at booking",
        )
    log_activity(
        db, "reservation_created", entity_type="reservation", entity_id=reservation.id,
        res_no=reservation.reservation_number, guest=_guest_name(db, reservation.guest_id),
    )
    return reservation


def update_reservation(db: Session, res_id: int, data: ReservationUpdate) -> Reservation:
    res = db.query(Reservation).filter(Reservation.id == res_id).first()
    if not res:
        raise HTTPException(404, "Reservation not found")
    updates = data.model_dump(exclude_none=True)
    # Moving the stay (new room, dates or time window) must not land on
    # another booking.
    if any(k in updates for k in ("room_id", "check_in_date", "check_out_date", "stay_starts_at", "stay_ends_at")) \
            and res.status in ("confirmed", "checked_in"):
        room = db.query(Room).filter(Room.id == updates.get("room_id", res.room_id)).first()
        if not room:
            raise HTTPException(404, "Room not found")
        _require_room_free(
            db, room,
            updates.get("check_in_date", res.check_in_date),
            updates.get("check_out_date", res.check_out_date),
            updates.get("rate_plan", res.rate_plan) or "OS",
            updates.get("stay_starts_at", res.stay_starts_at),
            updates.get("stay_ends_at", res.stay_ends_at),
            exclude_res_id=res.id,
        )
    for field, value in updates.items():
        setattr(res, field, value)
    if data.check_in_date or data.check_out_date:
        ci = data.check_in_date or res.check_in_date
        co = data.check_out_date or res.check_out_date
        res.nights = (co - ci).days
    db.commit()
    db.refresh(res)
    return res


def _require_verified_id(db: Session, guest_id: int) -> None:
    """Check-in policy: no check-in without ID verification, no exceptions.

    The guest must have an ID type and number on file, and the ID must not be
    expired when an expiry date is recorded.
    """
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest or not guest.id_type or not guest.id_number:
        raise HTTPException(
            400,
            "Check-in refused: guest ID not verified. Record the guest's ID type "
            "and ID number before check-in.",
        )
    if guest.id_expiry_date and guest.id_expiry_date < date.today():
        raise HTTPException(
            400,
            f"Check-in refused: guest ID expired on {guest.id_expiry_date.isoformat()}. "
            "Update the guest's ID before check-in.",
        )


def _require_payment_settled(db: Session, res: Reservation) -> None:
    """Check-in policy: the folio must be settled before check-in. The folio is
    the single source of truth — the stay is billed to it at booking time."""
    from . import billing_service

    totals = billing_service.summarize_folio(db, res.id)
    balance = float(totals.balance)
    if balance > 0.01:
        raise HTTPException(
            400,
            f"Check-in refused: balance due {balance:,.0f} FCFA. "
            "Collect payment before check-in.",
        )


def _require_active_card(db: Session, res: Reservation) -> None:
    """Check-in policy: the room's key card must be activated for this stay."""
    from ..models.keycard import KeyCard

    card = (
        db.query(KeyCard)
        .filter(KeyCard.reservation_id == res.id, KeyCard.status == "active")
        .first()
    )
    if not card:
        raise HTTPException(
            400,
            "Check-in refused: room key card not activated. "
            "Activate and validate the room card first.",
        )


def check_in(db: Session, res_id: int) -> Reservation:
    res = db.query(Reservation).filter(Reservation.id == res_id).first()
    if not res:
        raise HTTPException(404, "Reservation not found")
    if res.status != "confirmed":
        raise HTTPException(400, f"Cannot check in a reservation with status '{res.status}'")
    _require_verified_id(db, res.guest_id)
    _require_payment_settled(db, res)
    _require_active_card(db, res)
    res.status = "checked_in"
    res.actual_check_in = datetime.now()
    room = db.query(Room).filter(Room.id == res.room_id).first()
    if room:
        room.status = "occupied"
    db.commit()
    db.refresh(res)
    log_activity(
        db, "guest_checked_in", entity_type="reservation", entity_id=res.id,
        guest=_guest_name(db, res.guest_id), room=room.room_number if room else str(res.room_id),
    )
    return res


def _require_no_unsettled_debt(db: Session, res: Reservation) -> None:
    """Check-out policy: the folio must be fully settled. Even though check-in
    requires a settled folio, extras and nightly room rent posted during the
    stay can leave a debt by departure."""
    from . import billing_service

    totals = billing_service.summarize_folio(db, res.id)
    balance = float(totals.balance)
    if balance > 0.01:
        raise HTTPException(
            400,
            f"Check-out refused: unsettled balance of {balance:,.0f} FCFA. "
            "Settle the folio before check-out.",
        )


def check_out(db: Session, res_id: int) -> Reservation:
    res = db.query(Reservation).filter(Reservation.id == res_id).first()
    if not res:
        raise HTTPException(404, "Reservation not found")
    if res.status != "checked_in":
        raise HTTPException(400, f"Cannot check out a reservation with status '{res.status}'")
    _require_no_unsettled_debt(db, res)
    res.status = "checked_out"
    res.actual_check_out = datetime.now()
    # Departure revokes room access immediately — expire the guest's card
    # rather than letting it ride out its scheduled validity.
    from ..models.keycard import KeyCard
    from .keycard_service import get_provider
    provider = get_provider()
    cards = db.query(KeyCard).filter(
        KeyCard.reservation_id == res.id, KeyCard.status == "active"
    ).all()
    for card in cards:
        if card.card_uid:
            provider.revoke_card(card.card_uid)
        card.status = "expired"
        card.expires_at = res.actual_check_out
        card.deactivated_at = res.actual_check_out
    room = db.query(Room).filter(Room.id == res.room_id).first()
    if room:
        room.status = "cleaning"
    db.commit()
    db.refresh(res)
    log_activity(
        db, "guest_checked_out", entity_type="reservation", entity_id=res.id,
        guest=_guest_name(db, res.guest_id), room=room.room_number if room else str(res.room_id),
    )
    return res
