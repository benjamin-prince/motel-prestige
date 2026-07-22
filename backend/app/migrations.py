"""Lightweight, idempotent schema patches.

The app bootstraps its schema with ``Base.metadata.create_all`` (no Alembic),
which creates missing *tables* but never adds missing *columns* to tables that
already exist. These patches fill that gap so existing installations pick up new
columns on startup. PostgreSQL-specific (``ADD COLUMN IF NOT EXISTS``).
"""
from sqlalchemy import text
from sqlalchemy.engine import Engine


def run_schema_patches(engine: Engine) -> None:
    with engine.begin() as conn:
        # folio_charges.charge_type — stable charge classifier that replaces the
        # fragile ``particular == "Room Rent"`` string check in billing math.
        conn.execute(text(
            "ALTER TABLE folio_charges ADD COLUMN IF NOT EXISTS charge_type VARCHAR(20)"
        ))
        # Backfill legacy rows so historical folios classify correctly.
        conn.execute(text(
            "UPDATE folio_charges SET charge_type = 'payment' "
            "WHERE charge_type IS NULL AND amount < 0"
        ))
        conn.execute(text(
            "UPDATE folio_charges SET charge_type = 'room' "
            "WHERE charge_type IS NULL AND particular = 'Room Rent'"
        ))
        conn.execute(text(
            "UPDATE folio_charges SET charge_type = 'extra' "
            "WHERE charge_type IS NULL"
        ))
        # properties.floor_min / floor_max — the floor range of a site
        # (e.g. -1 .. 4), used to locate facilities and validate room floors.
        conn.execute(text(
            "ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_min INTEGER NOT NULL DEFAULT 0"
        ))
        conn.execute(text(
            "ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_max INTEGER NOT NULL DEFAULT 0"
        ))
        # properties.floors — building layout: JSON array of {floor, label}
        # (e.g. -1 "Basement", 0 "Ground floor") to locate rooms & facilities.
        conn.execute(text(
            "ALTER TABLE properties ADD COLUMN IF NOT EXISTS floors TEXT"
        ))
        # rooms.price_short_stay — 2h Short Stay (SS) rate alongside the
        # nightly rate; NULL/0 means the room is overnight-only.
        conn.execute(text(
            "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS price_short_stay NUMERIC(10,2)"
        ))
        # rooms.stay_offer — what the room is sold as: OS (nuitée only),
        # SS (2h only) or BOTH. Rooms that already had a 2h rate offer both.
        conn.execute(text(
            "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS stay_offer VARCHAR(10) NOT NULL DEFAULT 'OS'"
        ))
        conn.execute(text(
            "UPDATE rooms SET stay_offer = 'BOTH' "
            "WHERE stay_offer = 'OS' AND COALESCE(price_short_stay, 0) > 0"
        ))
