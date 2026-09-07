@echo off
REM ── Motel Prestige — installe le demarrage automatique du poste d'encodage.
REM Double-cliquez ce fichier UNE fois, apres avoir verifie que le bridge et
REM l'application demarrent correctement a la main (etapes 5 a 7 du guide).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
pause
