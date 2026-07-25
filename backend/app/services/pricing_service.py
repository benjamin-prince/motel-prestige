"""Dynamic-pricing engine and rate calendar.

Given each room type's base rate and the day's forecast occupancy, apply the
active pricing rules (yield / seasonal / weekday) to derive an effective rate.
The forecast comes from existing reservation data, so the calendar is live.
"""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models.room import Room
from ..models.reservation import Reservation
from ..models.pricing import PricingRule

_OCCUPIED_STATUSES = ("confirmed", "checked_in", "checked_out")


def _occupancy_pct(db: Session, day: date, total: int) -> int:
    if not total:
        return 0
    occ = (
        db.query(Reservation)
        .filter(
            Reservation.check_in_date <= day,
            Reservation.check_out_date > day,
            Reservation.status.in_(_OCCUPIED_STATUSES),
        )
        .count()
    )
    return round(occ / total * 100)


def _matches(rule: PricingRule, room_type: str, day: date, occ_pct: int) -> bool:
    if rule.room_type and rule.room_type != room_type:
        return False
    if rule.rule_type == "occupancy":
        return occ_pct >= (rule.occupancy_min or 0)
    if rule.rule_type == "season":
        if rule.date_from and day < rule.date_from:
            return False
        if rule.date_to and day > rule.date_to:
            return False
        return True
    if rule.rule_type == "weekday":
        wds = [int(x) for x in (rule.weekdays or "").split(",") if x.strip().isdigit()]
        return day.weekday() in wds
    return False


def _apply(base: float, rule: PricingRule) -> float:
    v = float(rule.adjust_value or 0)
    return base + v if rule.adjust_type == "fixed" else base * (1 + v / 100)


def compute_rate(base: float, room_type: str, day: date, occ_pct: int, rules: list) -> tuple:
    eff = float(base)
    applied = []
    for r in rules:  # pre-sorted by priority
        if _matches(r, room_type, day, occ_pct):
            eff = _apply(eff, r)
            applied.append(r.name)
    return round(eff), applied


def rate_calendar(db: Session, days: int = 14, start: date | None = None) -> dict:
    start = start or date.today()
    rooms = db.query(Room).all()
    total = len(rooms)

    # base rate per room type = average nightly price of that type
    by_type: dict[str, list] = {}
    for r in rooms:
        by_type.setdefault(r.room_type, []).append(float(r.price_per_night or 0))
    base_by_type = {t: round(sum(v) / len(v)) for t, v in by_type.items()}

    rules = (
        db.query(PricingRule)
        .filter(PricingRule.is_active.is_(True))
        .order_by(PricingRule.priority, PricingRule.id)
        .all()
    )

    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        occ = _occupancy_pct(db, d, total)
        cells = {}
        for t, base in base_by_type.items():
            rate, applied = compute_rate(base, t, d, occ, rules)
            cells[t] = {
                "base": base,
                "rate": rate,
                "delta_pct": round((rate - base) / base * 100) if base else 0,
                "applied": applied,
            }
        out.append({
            "date": d.isoformat(),
            "weekday": d.weekday(),
            "occupancy_pct": occ,
            "rates": cells,
        })

    return {
        "room_types": list(base_by_type.keys()),
        "base_by_type": base_by_type,
        "days": out,
    }
