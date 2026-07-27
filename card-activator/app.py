"""
Card Time Activator — a tiny standalone staff tool to activate an Orbita RFID
card for a chosen duration (1 hour … 1 month).

One self-contained FastAPI app: JSON API + a served single-page UI + SQLite.
Runs anywhere as one container. The physical encode goes through the on-prem
Orbita bridge (hardware/orbita_bridge) via ORBITA_BRIDGE_URL — reachable when
this runs on/near the front-desk PC. Online (VPS) it records the activation and
reports the encoder as offline; run the same image locally to encode for real.
"""
import hashlib
import hmac
import json
import os
import socket
import sqlite3
import time
import urllib.error
import urllib.request
from contextlib import closing
from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ── Config ────────────────────────────────────────────────────────────────────
APP_PASSWORD   = os.environ.get("APP_PASSWORD", "prestige")
SECRET         = os.environ.get("SECRET_KEY", "card-activator-dev-secret-change-me")
DB_PATH        = os.environ.get("DB_PATH", "/data/activations.db")
BRIDGE_URL     = os.environ.get("ORBITA_BRIDGE_URL", "http://localhost:8765").rstrip("/")
BRIDGE_API_KEY = os.environ.get("ORBITA_BRIDGE_API_KEY", "")
BUILDING       = os.environ.get("ORBITA_BUILDING", "01")
TOKEN_TTL      = int(os.environ.get("TOKEN_TTL_SECONDS", str(12 * 3600)))
MIN_HOURS      = 1
MAX_HOURS      = 24 * 31          # 1 month
TIME_FORMAT    = "%Y-%m-%d %H:%M:%S"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="Card Time Activator", docs_url=None, redoc_url=None)


# ── Storage ───────────────────────────────────────────────────────────────────
def db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with closing(db()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS activations (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                card_label     TEXT,
                room           TEXT,
                building       TEXT,
                duration_hours REAL NOT NULL,
                valid_from     TEXT NOT NULL,
                expires_at     TEXT NOT NULL,
                status         TEXT NOT NULL DEFAULT 'active',
                encoded        INTEGER NOT NULL DEFAULT 0,
                encode_error   TEXT,
                card_uid       TEXT,
                created_at     TEXT NOT NULL
            )
            """
        )
        # migrate older DBs created before the building column existed
        cols = [c[1] for c in conn.execute("PRAGMA table_info(activations)").fetchall()]
        if "building" not in cols:
            conn.execute("ALTER TABLE activations ADD COLUMN building TEXT")
        conn.commit()


init_db()


# ── Auth (single shared staff password → HMAC bearer token) ───────────────────
def make_token() -> str:
    exp = str(int(time.time()) + TOKEN_TTL)
    sig = hmac.new(SECRET.encode(), exp.encode(), hashlib.sha256).hexdigest()
    return f"{exp}.{sig}"


def valid_token(token: str) -> bool:
    try:
        exp, sig = token.split(".", 1)
    except ValueError:
        return False
    expected = hmac.new(SECRET.encode(), exp.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected) and int(exp) > time.time()


def require_auth(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not valid_token(token):
        raise HTTPException(401, "Not authenticated")
    return True


# ── Orbita encode via the bridge ──────────────────────────────────────────────
def bridge_reachable(timeout: float = 1.5) -> bool:
    try:
        u = urlparse(BRIDGE_URL)
        host = u.hostname or "localhost"
        port = u.port or (443 if u.scheme == "https" else 80)
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def encode_card(room: str, valid_from: datetime, valid_until: datetime, building: str = BUILDING) -> dict:
    """Program a room guest card via the Orbita bridge — the same card the room's
    door lock AND its energy saver read. Returns {card_uid} or raises."""
    payload = {
        "building": (building or BUILDING),
        "room": room.zfill(4)[-4:],
        "commdoors": "00",
        "arrival": valid_from.strftime(TIME_FORMAT),
        "departure": valid_until.strftime(TIME_FORMAT),
        "suspendnum": "000000",
        "mode": 0,
        "data11": "",
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if BRIDGE_API_KEY:
        headers["Authorization"] = f"Bearer {BRIDGE_API_KEY}"
    req = urllib.request.Request(f"{BRIDGE_URL}/write", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError) as exc:
        raise RuntimeError(f"Encoder offline ({BRIDGE_URL}): {exc}") from exc
    if result.get("error_code", 0) != 0:
        raise RuntimeError(f"Encoder error {result.get('error_code')}: {result.get('message', 'unknown')}")
    return {"card_uid": result.get("card_id") or result.get("card_no") or ""}


def bridge_delete(room: str, card_uid: str) -> None:
    payload = {"card_uid": card_uid} if card_uid else {"room": room.zfill(4)[-4:]}
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if BRIDGE_API_KEY:
        headers["Authorization"] = f"Bearer {BRIDGE_API_KEY}"
    req = urllib.request.Request(f"{BRIDGE_URL}/delete", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=20):
        pass


# ── Serialization ─────────────────────────────────────────────────────────────
def row_to_dict(r: sqlite3.Row) -> dict:
    now = datetime.now()
    expires = datetime.fromisoformat(r["expires_at"])
    if r["status"] == "revoked":
        state = "revoked"
    elif now >= expires:
        state = "expired"
    else:
        state = "active"
    remaining = max(0, int((expires - now).total_seconds()))
    return {
        "id": r["id"],
        "card_label": r["card_label"],
        "room": r["room"],
        "building": (r["building"] if "building" in r.keys() else None),
        "duration_hours": r["duration_hours"],
        "valid_from": r["valid_from"],
        "expires_at": r["expires_at"],
        "status": r["status"],
        "state": state,
        "remaining_seconds": remaining,
        "encoded": bool(r["encoded"]),
        "encode_error": r["encode_error"],
        "card_uid": r["card_uid"],
        "created_at": r["created_at"],
    }


# ── Schemas ───────────────────────────────────────────────────────────────────
class LoginIn(BaseModel):
    password: str


class ActivateIn(BaseModel):
    hours: float = Field(gt=0)
    room: str | None = None
    building: str | None = None
    card_label: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────────
@app.post("/api/login")
def login(body: LoginIn):
    if not hmac.compare_digest(body.password, APP_PASSWORD):
        raise HTTPException(401, "Wrong password")
    return {"token": make_token()}


@app.get("/api/status")
def status(_: bool = Depends(require_auth)):
    return {"encoder_online": bridge_reachable(), "building": BUILDING, "bridge_url": BRIDGE_URL}


@app.get("/api/activations")
def list_activations(_: bool = Depends(require_auth)):
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM activations ORDER BY id DESC LIMIT 100").fetchall()
    return [row_to_dict(r) for r in rows]


@app.post("/api/activations", status_code=201)
def activate(body: ActivateIn, _: bool = Depends(require_auth)):
    hours = max(MIN_HOURS, min(MAX_HOURS, float(body.hours)))
    now = datetime.now().replace(microsecond=0)
    expires = now + timedelta(hours=hours)

    building = (body.building or BUILDING)
    encoded, encode_error, card_uid = 0, None, None
    if body.room:  # room-keyed on Orbita — one card = door lock + energy saver
        try:
            res = encode_card(body.room, now, expires, building)
            encoded, card_uid = 1, res["card_uid"]
        except RuntimeError as exc:
            encode_error = str(exc)

    with closing(db()) as conn:
        cur = conn.execute(
            """INSERT INTO activations
               (card_label, room, building, duration_hours, valid_from, expires_at, status,
                encoded, encode_error, card_uid, created_at)
               VALUES (?,?,?,?,?,?, 'active', ?,?,?,?)""",
            (body.card_label, body.room, building, hours, now.isoformat(), expires.isoformat(),
             encoded, encode_error, card_uid, now.isoformat()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM activations WHERE id=?", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)


@app.post("/api/activations/{act_id}/revoke")
def revoke(act_id: int, _: bool = Depends(require_auth)):
    with closing(db()) as conn:
        row = conn.execute("SELECT * FROM activations WHERE id=?", (act_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        if row["room"] and row["encoded"]:
            try:
                bridge_delete(row["room"], row["card_uid"] or "")
            except OSError:
                pass  # best-effort; still mark revoked in our records
        conn.execute("UPDATE activations SET status='revoked' WHERE id=?", (act_id,))
        conn.commit()
        row = conn.execute("SELECT * FROM activations WHERE id=?", (act_id,)).fetchone()
    return row_to_dict(row)


# ── Static UI ─────────────────────────────────────────────────────────────────
@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/healthz")
def healthz():
    return JSONResponse({"status": "ok"})


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
