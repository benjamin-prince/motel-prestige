@echo off
REM ── Retire le demarrage automatique. Le bridge et l'application restent
REM utilisables a la main (start-bridge.bat / run-local.bat).
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "foreach ($t in 'MotelPrestige-OrbitaBridge','MotelPrestige-CardActivator','MotelPrestige-StationWatchdog') { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue; Write-Host ('  [retire] ' + $t) }"
pause
