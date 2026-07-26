# Card Time Activator

A tiny standalone staff tool to activate an **Orbita RFID card** for a chosen
duration — **1 hour to 1 month**. One self-contained container: FastAPI + a
served single-page UI + SQLite. No dependency on the PMS.

- **Online** (VPS, `book.motel-prestige.com`): use it to create/track activations
  from anywhere. The physical encoder is at the front desk, so online it records
  the activation and reports the encoder as *offline*.
- **Local** (same PC/LAN as the encoder): run the same image with
  `ORBITA_BRIDGE_URL` pointing at the Orbita bridge, and it **encodes the real card**.

## How it works

Pick a duration → the app stores an activation (`valid_from = now`,
`expires_at = now + duration`). If a **Room** is given, it calls the on-prem
Orbita bridge (`hardware/orbita_bridge/bridge.py`) `POST /write` with the same
payload the PMS uses, so the physical card is programmed for that window.

## Run locally (front-desk PC, next to the encoder)

```bash
# 1) The Orbita bridge must be running on this PC (see hardware/orbita_bridge)
# 2) Then:
ORBITA_BRIDGE_URL=http://host.docker.internal:8765 \
ORBITA_BRIDGE_API_KEY=<same-secret-as-bridge> \
APP_PASSWORD=<staff-password> \
docker compose up -d --build
# → http://localhost:8080
```

Or without Docker: `pip install -r requirements.txt && uvicorn app:app --port 8080`
(bridge then at `http://localhost:8765`).

## Environment

| Var | Default | Purpose |
|-----|---------|---------|
| `APP_PASSWORD` | `prestige` | Staff login password |
| `SECRET_KEY` | dev value | HMAC secret for session tokens — **set this** |
| `ORBITA_BRIDGE_URL` | `http://localhost:8765` | The Orbita bridge to encode through |
| `ORBITA_BRIDGE_API_KEY` | – | Shared secret matching the bridge |
| `ORBITA_BUILDING` | `01` | Orbita building code |
| `DB_PATH` | `/data/activations.db` | SQLite file (mount a volume) |
| `TZ` | `America/New_York` | Local time used for the access window |

## Notes

- Encoding is **room-keyed** on Orbita — leave Room empty to just record a
  time-card without programming a physical card.
- Online + offline share nothing; each instance keeps its own SQLite DB.
