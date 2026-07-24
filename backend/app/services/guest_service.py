"""Guest 360 profile — lifetime value and stay history for the CRM view.

Everything is derived from existing reservation / folio data, so the profile
stays accurate without any extra bookkeeping.
"""
from datetime import date

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.guest import Guest
from ..models.reservation import Reservation
from ..models.room import Room
from ..models.billing import FolioCharge

# Loyalty tiers suggested from lifetime nights (staff can still override).
_TIER_BY_NIGHTS = [(30, "platinum"), (15, "gold"), (5, "silver")]


def suggest_tier(total_nights: int) -> str:
    for threshold, tier in _TIER_BY_NIGHTS:
        if total_nights >= threshold:
            return tier
    return "standard"


def get_profile(db: Session, guest_id: int) -> dict:
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(404, "Guest not found")

    reservations = (
        db.query(Reservation)
        .filter(Reservation.guest_id == guest_id)
        .order_by(Reservation.check_in_date.desc())
        .all()
    )
    today = date.today()
    completed = [r for r in reservations if r.status in ("checked_in", "checked_out")]
    upcoming = [r for r in reservations if r.status == "confirmed" and r.check_in_date >= today]

    total_stays = len(completed)
    total_nights = sum(r.nights or 0 for r in completed)
    last_stay = max((r.check_out_date for r in completed), default=None)

    # Spend + per-reservation revenue (room + extras, non-void) in one grouped pass.
    res_ids = [r.id for r in reservations]
    spend_by_res: dict[int, float] = {}
    total_spend = 0.0
    if res_ids:
        rows = (
            db.query(FolioCharge.reservation_id, func.coalesce(func.sum(FolioCharge.amount), 0))
            .filter(
                FolioCharge.reservation_id.in_(res_ids),
                FolioCharge.is_void.isnot(True),
                FolioCharge.charge_type.in_(("room", "extra")),
            )
            .group_by(FolioCharge.reservation_id)
            .all()
        )
        spend_by_res = {rid: float(amt) for rid, amt in rows}
        total_spend = sum(spend_by_res.values())

    room_num = {rm.id: rm.room_number for rm in db.query(Room).all()}

    def row(r: Reservation) -> dict:
        return {
            "id": r.id,
            "reservation_number": r.reservation_number,
            "room": room_num.get(r.room_id, f"#{r.room_id}"),
            "check_in_date": r.check_in_date.isoformat() if r.check_in_date else None,
            "check_out_date": r.check_out_date.isoformat() if r.check_out_date else None,
            "nights": r.nights,
            "status": r.status,
            "amount": spend_by_res.get(r.id, 0.0),
        }

    return {
        "guest": {c.name: getattr(guest, c.name) for c in Guest.__table__.columns},
        "stats": {
            "total_stays": total_stays,
            "total_nights": total_nights,
            "total_spend": round(total_spend, 2),
            "avg_spend": round(total_spend / total_stays, 2) if total_stays else 0.0,
            "last_stay": last_stay.isoformat() if last_stay else None,
            "upcoming_count": len(upcoming),
            "suggested_tier": suggest_tier(total_nights),
        },
        "history": [row(r) for r in reservations[:30]],
        "upcoming": [row(r) for r in upcoming],
    }
