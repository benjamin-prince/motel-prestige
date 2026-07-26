@echo off
REM ── Orbita bridge — run on the front-desk Windows PC (USB encoder plugged in)
REM Requires 32-bit Python 3 (CLock.dll is a 32-bit DLL) and CLock.dll in this folder.

REM ▼▼▼ EDIT THIS ▼▼▼  (any secret; use the SAME value in the app's run-local.bat)
set ORBITA_BRIDGE_API_KEY=change-me-shared-secret
REM ▲▲▲ EDIT THIS ▲▲▲

set ORBITA_BRIDGE_PORT=8765

echo Installing bridge dependencies (first run only)...
python -m pip install -r requirements.txt

echo.
echo ================================================================
echo  Orbita bridge running on port %ORBITA_BRIDGE_PORT%
echo  Keep this window open. Close it to stop.
echo  (Do the Orbita authorization step once before first use.)
echo ================================================================
echo.
python bridge.py
pause
