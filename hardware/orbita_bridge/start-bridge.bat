@echo off
REM ── Orbita bridge — run on the front-desk Windows PC (USB encoder plugged in)
REM Requires 32-bit Python 3 (CLock.dll is a 32-bit DLL) and CLock.dll in this folder.

REM ▼▼▼ EDIT THIS ▼▼▼  (any secret; use the SAME value in the app's run-local.bat)
set ORBITA_BRIDGE_API_KEY=change-me-shared-secret
REM ▲▲▲ EDIT THIS ▲▲▲

set ORBITA_BRIDGE_PORT=8765

REM ── Locate a 32-bit Python 3.12 ──────────────────────────────────────────
REM PATH is NOT required: we look in the standard install folders and via the
REM py launcher first. This is why "Add python.exe to PATH" being unticked at
REM install time no longer breaks the station.
set "PY="
for %%P in (
  "%LOCALAPPDATA%\Programs\Python\Python312-32\python.exe"
  "C:\Python312-32\python.exe"
  "%ProgramFiles(x86)%\Python312-32\python.exe"
  "%ProgramFiles(x86)%\Python\Python312-32\python.exe"
) do if not defined PY if exist %%P set PY="%%~P"
if not defined PY (
  py -3.12-32 -c "import sys" >nul 2>&1
  if not errorlevel 1 set "PY=py -3.12-32"
)
if not defined PY (
  py -3-32 -c "import sys" >nul 2>&1
  if not errorlevel 1 set "PY=py -3-32"
)
if not defined PY (
  python -c "import struct,sys;sys.exit(0 if struct.calcsize('P')*8==32 else 1)" >nul 2>&1
  if not errorlevel 1 set "PY=python"
)

if not defined PY (
  echo.
  echo ============================================================
  echo  !! Python 3.12 ^(32-bit^) introuvable.
  echo.
  echo     Installez "Windows installer ^(32-bit^)" depuis python.org
  echo     ^(le fichier finit par x86, PAS amd64^).
  echo     Cochez "Add python.exe to PATH" — ou laissez-le decoche,
  echo     ce script sait le trouver dans le dossier d'installation.
  echo ============================================================
  echo.
  call :hold
  exit /b 1
)

%PY% -c "import struct,sys;sys.exit(0 if struct.calcsize('P')*8==32 else 1)" 2>nul
if errorlevel 1 (
  echo.
  echo ============================================================
  echo  !! Le Python trouve est en 64 bits. Le pilote de l'encodeur
  echo     CLock.dll est 32 bits et exige Python 3.12 32 bits.
  echo     Installez la version "x86" depuis python.org.
  echo ============================================================
  echo.
  call :hold
  exit /b 1
)

echo Installing bridge dependencies (first run only)...
REM Prefer the bundled 32-bit / Python 3.12 wheels in vendor\; fall back to the
REM internet only if they don't match this Python (they must for CLock.dll — 32-bit).
%PY% -m pip install --find-links vendor -r requirements.txt

echo.
echo ================================================================
echo  Orbita bridge running on port %ORBITA_BRIDGE_PORT%
echo  Keep this window open. Close it to stop.
echo  (Do the Orbita authorization step once before first use.)
echo ================================================================
echo.
%PY% bridge.py
call :hold
goto :eof

REM Autostart (Task Scheduler) sets CARD_STATION_AUTOSTART: never block on a
REM keypress there, or the task hangs instead of restarting.
:hold
if not defined CARD_STATION_AUTOSTART pause
goto :eof
