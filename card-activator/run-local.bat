@echo off
REM ── Card Time Activator — run on the front-desk Windows PC (next to the encoder)
REM Prereq: the Orbita bridge is already running on this PC (python bridge.py, :8765).
REM Then double-click this file. Open http://localhost:8080 in the browser.

REM ▼▼▼ EDIT THESE ▼▼▼
set APP_PASSWORD=Prestige2026
set SECRET_KEY=change-me-to-something-random
set ORBITA_BRIDGE_API_KEY=
REM ^ must match ORBITA_BRIDGE_API_KEY set on the bridge (bridge.py). Leave blank if the bridge has none.
REM ▲▲▲ EDIT THESE ▲▲▲

set ORBITA_BRIDGE_URL=http://localhost:8765
set ORBITA_BUILDING=01
set DB_PATH=activations.db

echo Installing dependencies (first run only)...
REM Prefer the bundled 32-bit / Python 3.12 wheels in vendor\; fall back to the
REM internet only if they don't match this Python.
python -m pip install --find-links vendor fastapi uvicorn

echo.
echo ================================================================
echo  Card Time Activator running →  http://localhost:8080
echo  Password: %APP_PASSWORD%
echo  Encoder bridge: %ORBITA_BRIDGE_URL%
echo  Keep this window open. Close it to stop.
echo ================================================================
echo.
python -m uvicorn app:app --host 0.0.0.0 --port 8080
pause
