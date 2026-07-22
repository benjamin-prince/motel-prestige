# Orbita Lock System bridge

`CLock.dll` is a 32-bit Windows DLL bound to a USB card encoder — it can only run
on the front-desk Windows PC where the encoder is physically plugged in, and it
cannot be loaded by the PMS backend (which runs on Linux/macOS). This bridge is
the piece that does run on that Windows PC: it loads the DLL via `ctypes` and
exposes its `dv_*` functions as a small JSON/HTTP API.

The PMS backend's `OrbitaProvider` (`backend/app/services/keycard_service.py`)
calls this bridge over HTTP — see `docs/` for the full SDK reference (PDF) and
the vendor's Delphi sample app.

## Setup (on the front-desk Windows PC)

1. Install **32-bit Python 3** (required — `CLock.dll` will fail to load under
   64-bit Python with `OSError: [WinError 193] %1 is not a valid Win32 application`)
2. Copy `CLock.dll` (from `docs/CLock.dll` or the original SDK kit) into this folder,
   alongside `bridge.py`
3. `pip install -r requirements.txt`
4. Run the Orbita authorization step once (per the SDK PDF — open the Orbita lock
   system, complete the authorization dialog) before starting the bridge
5. Start it:
   ```
   set ORBITA_BRIDGE_API_KEY=<shared-secret-matching-backend-.env>
   python bridge.py
   ```
   It listens on port 8765 by default (override with `ORBITA_BRIDGE_PORT`).
6. Point the PMS backend at it via `.env`:
   ```
   keycard_provider=orbita
   orbita_bridge_url=http://<this-pc-ip>:8765
   orbita_bridge_api_key=<same-shared-secret>
   orbita_building=01
   ```

## Running it as a background service

For production use, run `bridge.py` via something that keeps it alive and starts
it on boot — e.g. NSSM (Non-Sucking Service Manager) to wrap it as a Windows
service, or Task Scheduler with "run at startup". The encoder must remain plugged
into this PC at all times.

## Notes

- The encoder is a single physical device — the bridge serializes all calls to it
  with a lock, so concurrent issue/revoke requests from the PMS queue safely.
- `dv_delete_card` is keyed on **room number**, not card UID. The bridge keeps an
  in-memory `card_uid -> room` map populated at write time so `OrbitaProvider.revoke_card(uid)`
  can still work from just the UID. This map is lost on restart — if the bridge
  restarts, pass `{"room": "0101"}` directly to `/delete` instead of `card_uid`.
- Error codes returned in `{"error_code": ..., "message": ...}` come straight from
  the SDK's documented list (see the PDF, "Error coders list").
