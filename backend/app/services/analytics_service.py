"""Executive dashboard analytics — occupancy, ADR, RevPAR, revenue and a
daily trend, aggregated from live room / reservation / folio data.

Kept intentionally simple: everything is derived from data the PMS already
records (room status, reservation dates, posted folio charges), so no extra
snapshot tables are required.
"""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.room import Room
from ..models.reservation import Reservation
from ..models.billing import FolioCharge

# Revenue that counts toward the top line (room rent + billable extras).
# Payments/discounts/tax are settlement lines, not revenue, so excluded.
_REVENUE_TYPES = ("room", "extra")


def _revenue(db: Session, start: date, end: date, types=_REVENUE_TYPES) -> float:
    """Sum posted (non-void) folio charges of the given types, date in [start, end]."""
    total = (
        db.query(func.coalesce(func.sum(FolioCharge.amount), 0))
        .filter(
            FolioCharge.date >= start,
            FolioCharge.date <= end,
            FolioCharge.is_void.isnot(True),
            FolioCharge.charge_type.in_(types),
        )
        .scalar()
    )
    return float(Decimal(str(total or 0)))


def _occupancy_on(db: Session, day: date) -> int:
    """Rooms occupied on a given night — reservations whose stay spans it."""
    return (
        db.query(Reservation)
        .filter(
            Reservation.check_in_date <= day,
            Reservation.check_out_date > day,
            Reservation.status.in_(("checked_in", "checked_out")),
        )
        .count()
    )


def get_overview(db: Session, today: date | None = None, trend_days: int = 7) -> dict:
    today = today or date.today()

    rooms = db.query(Room).all()
    total = len(rooms)
    by_status = {"available": 0, "occupied": 0, "cleaning": 0, "maintenance": 0}
    for r in rooms:
        if r.status in by_status:
            by_status[r.status] += 1
    occupied = by_status["occupied"]
    occ_pct = round(occupied / total * 100) if total else 0

    room_rev_today = _revenue(db, today, today, ("room",))
    revenue_today = _revenue(db, today, today)
    revenue_mtd = _revenue(db, today.replace(day=1), today)

    # ADR = room revenue / rooms sold; RevPAR = room revenue / rooms available.
    adr = round(room_rev_today / occupied, 2) if occupied else 0.0
    revpar = round(room_rev_today / total, 2) if total else 0.0

    arrivals_today = (
        db.query(Reservation)
        .filter(Reservation.status == "confirmed", Reservation.check_in_date == today)
        .count()
    )
    departures_today = (
        db.query(Reservation)
        .filter(Reservation.status == "checked_in", Reservation.check_out_date == today)
        .count()
    )

    trend = []
    for i in range(trend_days - 1, -1, -1):
        d = today - timedelta(days=i)
        occ = _occupancy_on(db, d)
        trend.append({
            "date": d.isoformat(),
            "revenue": _revenue(db, d, d),
            "occupancy": occ,
            "occupancy_pct": round(occ / total * 100) if total else 0,
        })

    return {
        "date": today.isoformat(),
        "rooms": {"total": total, **by_status},
        "occupancy_pct": occ_pct,
        "adr": adr,
        "revpar": revpar,
        "revenue_today": revenue_today,
        "room_revenue_today": room_rev_today,
        "revenue_mtd": revenue_mtd,
        "arrivals_today": arrivals_today,
        "departures_today": departures_today,
        "trend": trend,
    }
