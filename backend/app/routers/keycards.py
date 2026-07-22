import json
from datetime import datetime, time as dtime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require
from ..models.keycard import KeyCard, KeyCardAccessLog
from ..schemas.keycard import (
    KeyCardIssue, KeyCardIssueOperational, KeyCardExtend,
    KeyCardUpdate, KeyCardResponse, AccessLogResponse,
)
from ..services.keycard_service import get_provider, generate_card_number
from ..services.activity_logger import log_activity
from ..services.crud import get_or_404

router = APIRouter(prefix="/keycards", tags=["Key Cards"])


@router.get("/", response_model=List[KeyCardResponse], dependencies=[Depends(require("kc.view"))])
def list_cards(
    reservation_id: Optional[int] = None,
    status: Optional[str] = None,
    card_type: Optional[str] = None,
    operational: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    q = db.query(KeyCard)
    if reservation_id:
        q = q.filter(KeyCard.reservation_id == reservation_id)
    if status:
        q = q.filter(KeyCard.status == status)
    if card_type:
        q = q.filter(KeyCard.card_type == card_type)
    if operational is True:
        q = q.filter(KeyCard.card_type != "guest")
    elif operational is False:
        q = q.filter(KeyCard.card_type == "guest")
    return q.order_by(KeyCard.issued_at.desc()).all()


@router.post("/issue", response_model=KeyCardResponse, status_code=201, dependencies=[Depends(require("kc.issue", "kc.issue.new_booking"))])
def issue_card(data: KeyCardIssue, db: Session = Depends(get_db)):
    from ..models.room import Room
    room = get_or_404(db, Room, id=data.room_id)

    provider = get_provider()
    card_uid = provider.generate_uid()
    card_number = generate_card_number()
    valid_from = data.valid_from or datetime.now()

    encoded = provider.encode_card(
        card_uid=card_uid,
        room_number=room.room_number,
        valid_from=valid_from,
        valid_until=data.expires_at,
    )
    card_uid = encoded.get("card_uid") or card_uid

    card = KeyCard(
        card_number=card_number,
        card_uid=card_uid,
        reservation_id=data.reservation_id,
        guest_id=data.guest_id,
        room_id=data.room_id,
        card_type=data.card_type,
        status="active",
        valid_from=valid_from,
        expires_at=data.expires_at,
        encoded_data=encoded,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    log_activity(db, "keycard_issued", entity_type="keycard", entity_id=card.id,
                 card=card.card_number, room=room.room_number)
    return card


@router.post("/issue-operational", response_model=KeyCardResponse, status_code=201, dependencies=[Depends(require("kc.issue"))])
def issue_operational_card(data: KeyCardIssueOperational, db: Session = Depends(get_db)):
    from ..models.room import Room
    provider = get_provider()
    valid_from = data.valid_from or datetime.now()

    # Use supplied UID or generate one
    card_uid = data.card_uid or provider.generate_uid()
    card_number = generate_card_number()

    room = db.query(Room).filter(Room.id == data.room_id).first() if data.room_id else None
    room_label = room.room_number if room else ("ALL" if data.card_type == "master" else "ZONE")

    # The Orbita SDK (dv_write_card) can only encode GUEST room cards. Master,
    # emergency, maintenance, building and floor cards are created inside the
    # Orbita lock software (Staff Card dialog), by design — a third-party
    # integration must never be able to mint a master key. So for those types
    # the PMS records the card only; the operator encodes it in Orbita.
    OPERATIONAL_TYPES = {"master", "emergency", "maintenance", "building", "floor", "staff", "housekeeping"}
    if data.card_type in OPERATIONAL_TYPES:
        encoded = {
            "provider": "manual",
            "card_uid": card_uid,
            "note": "Carte opérationnelle — à encoder dans le logiciel Orbita (Staff Card).",
            "recorded_at": datetime.now().isoformat(),
        }
    else:
        encoded = provider.encode_card(
            card_uid=card_uid,
            room_number=room_label,
            valid_from=valid_from,
            valid_until=data.expires_at,
        )
        card_uid = encoded.get("card_uid") or card_uid

    card = KeyCard(
        card_number=card_number,
        card_uid=card_uid,
        room_id=data.room_id,
        staff_id=data.staff_id,
        assigned_to_name=data.assigned_to_name,
        card_type=data.card_type,
        status="active",
        valid_from=valid_from,
        expires_at=data.expires_at,
        access_zones=json.dumps(data.access_zones) if data.access_zones else None,
        notes=data.notes,
        encoded_data=encoded,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    log_activity(db, "keycard_issued", entity_type="keycard", entity_id=card.id,
                 card=card.card_number, type=data.card_type, room=room_label)
    return card


class ActivateRoomCard(BaseModel):
    reservation_id: int


@router.post("/activate-room-card", response_model=KeyCardResponse,
             dependencies=[Depends(require("fo.checkin", "kc.issue"))])
def activate_room_card(data: ActivateRoomCard, db: Session = Depends(get_db)):
    """Check-in flow: each room has one permanent guest card — (re)activate it
    for this reservation's stay window. Created on first use if missing."""
    from ..models.reservation import Reservation
    from ..models.room import Room

    res = get_or_404(db, Reservation, id=data.reservation_id, name="Reservation")
    if res.status != "confirmed":
        raise HTTPException(400, f"Cannot activate a card for a reservation with status '{res.status}'")
    room = get_or_404(db, Room, id=res.room_id)

    card = (
        db.query(KeyCard)
        .filter(KeyCard.room_id == room.id, KeyCard.card_type == "guest")
        .order_by(KeyCard.id.desc())
        .first()
    )

    provider = get_provider()
    now = datetime.now()
    if res.rate_plan == "SS":
        # Short Stay (2h): the clock starts at check-in — card is valid for
        # exactly 2 hours from now. Re-anchor the reservation's occupancy
        # window to the actual stay so room availability reflects reality.
        expires = now + timedelta(hours=2)
        res.stay_starts_at = now
        res.stay_ends_at = expires
    else:
        expires = datetime.combine(res.check_out_date, dtime(12, 0))  # checkout at noon

    if not card:
        card = KeyCard(
            card_number=generate_card_number(),
            card_uid=provider.generate_uid(),
            room_id=room.id,
            card_type="guest",
            status="active",
            valid_from=now,
            expires_at=expires,
        )
        db.add(card)

    encoded = provider.encode_card(
        card_uid=card.card_uid,
        room_number=room.room_number,
        valid_from=now,
        valid_until=expires,
    )
    card.card_uid = encoded.get("card_uid") or card.card_uid
    card.encoded_data = encoded
    card.reservation_id = res.id
    card.guest_id = res.guest_id
    card.status = "active"
    card.valid_from = now
    card.expires_at = expires
    card.deactivated_at = None
    db.commit()
    db.refresh(card)
    log_activity(db, "keycard_issued", entity_type="keycard", entity_id=card.id,
                 card=card.card_number, room=room.room_number)
    return card


@router.post("/{card_id}/extend", response_model=KeyCardResponse, dependencies=[Depends(require("kc.issue"))])
def extend_card(card_id: int, data: KeyCardExtend, db: Session = Depends(get_db)):
    card = get_or_404(db, KeyCard, id=card_id, name="Card")
    if card.status not in ("active", "inactive"):
        raise HTTPException(400, "Can only extend active or inactive cards")
    old_expiry = card.expires_at
    card.expires_at = data.expires_at
    if card.status == "inactive" and data.expires_at > datetime.now():
        card.status = "active"
        card.deactivated_at = None
    db.commit()
    db.refresh(card)
    log_activity(db, "keycard_extended", entity_type="keycard", entity_id=card.id,
                 card=card.card_number, old_expiry=str(old_expiry), new_expiry=str(data.expires_at))
    return card


@router.post("/{card_id}/revoke", response_model=KeyCardResponse, dependencies=[Depends(require("kc.revoke"))])
def revoke_card(card_id: int, db: Session = Depends(get_db)):
    card = get_or_404(db, KeyCard, id=card_id, name="Card")
    provider = get_provider()
    if card.card_uid:
        provider.revoke_card(card.card_uid)
    card.status = "inactive"
    card.deactivated_at = datetime.now()
    db.commit()
    db.refresh(card)
    from ..models.room import Room
    room = db.query(Room).filter(Room.id == card.room_id).first()
    log_activity(db, "keycard_revoked", entity_type="keycard", entity_id=card.id,
                 card=card.card_number, room=room.room_number if room else "—")
    return card


@router.post("/{card_id}/report-lost", response_model=KeyCardResponse, dependencies=[Depends(require("kc.report_lost"))])
def report_lost(card_id: int, db: Session = Depends(get_db)):
    card = get_or_404(db, KeyCard, id=card_id, name="Card")
    provider = get_provider()
    if card.card_uid:
        provider.revoke_card(card.card_uid)
    card.status = "lost"
    card.deactivated_at = datetime.now()
    db.commit()
    db.refresh(card)
    log_activity(db, "keycard_lost", entity_type="keycard", entity_id=card.id,
                 card=card.card_number)
    return card


@router.post("/{card_id}/simulate-access", dependencies=[Depends(require("kc.test_access"))])
def simulate_access(card_id: int, door_location: str, reader_id: Optional[str] = None, db: Session = Depends(get_db)):
    card = get_or_404(db, KeyCard, id=card_id, name="Card")

    now = datetime.now()
    granted = card.status == "active" and card.valid_from <= now < card.expires_at
    denial_reason = None
    if card.status != "active":
        denial_reason = f"Card is {card.status}"
    elif now < card.valid_from:
        denial_reason = "Card not yet valid"
    elif card.expires_at <= now:
        denial_reason = "Card expired"

    log = KeyCardAccessLog(
        card_id=card_id,
        door_location=door_location,
        room_id=card.room_id,
        access_granted=granted,
        denial_reason=denial_reason,
        reader_id=reader_id,
    )
    if granted:
        card.access_count += 1
    db.add(log)
    db.commit()
    return {"granted": granted, "denial_reason": denial_reason}


@router.get("/{card_id}/logs", response_model=List[AccessLogResponse], dependencies=[Depends(require("kc.access_logs"))])
def card_logs(card_id: int, db: Session = Depends(get_db)):
    return db.query(KeyCardAccessLog).filter(
        KeyCardAccessLog.card_id == card_id
    ).order_by(KeyCardAccessLog.accessed_at.desc()).all()
