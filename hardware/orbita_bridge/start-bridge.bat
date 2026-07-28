@echo off
REM ── Orbita bridge — run on the front-desk Windows PC (USB encoder plugged in)
REM Requires 32-bit Python 3 (CLock.dll is a 32-bit DLL) and CLock.dll in this folder.

REM ▼▼▼ EDIT THIS ▼▼▼  (any secret; use the SAME value in the app's run-local.bat)
set ORBITA_BRIDGE_API_KEY=change-me-shared-secret
REM ▲▲▲ EDIT THIS ▲▲▲

set ORBITA_BRIDGE_PORT=8765

REM --- Check Python is present and 32-bit (CLock.dll is a 32-bit DLL) ---
python --version >nul 2>&1 || ( echo. & echo !! Python not found. Install Python 3.12 ^(32-bit^) and tick "Add to PATH". & echo. & pause & exit /b 1 )
python -c "import struct;exit(0 if struct.calcsize('P')*8==32 else 1)" 2>nul
if errorlevel 1 (
  echo.
  echo ============================================================
  echo  !! Your Python is 64-bit. The Orbita encoder driver
  echo     CLock.dll is 32-bit and needs 32-bit Python 3.12.
  echo     Install the "Windows installer ^(32-bit / x86^)" from
  echo     python.org, tick "Add to PATH", then run this again.
  echo ============================================================
  echo.
  pause
  exit /b 1
)

echo Installing bridge dependencies (first run only)...
REM Prefer the bundled 32-bit / Python 3.12 wheels in vendor\; fall back to the
REM internet only if they don't match this Python (they must for CLock.dll — 32-bit).
python -m pip install --find-links vendor -r requirements.txt

echo.
echo ================================================================
echo  Orbita bridge running on port %ORBITA_BRIDGE_PORT%
echo  Keep this window open. Close it to stop.
echo  (Do the Orbita authorization step once before first use.)
echo ================================================================
echo.
python bridge.py
pause
