@echo off
title BE INEVITABLE
cd /d "%~dp0"

echo ============================================
echo    BE INEVITABLE - Start
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] Node.js ist nicht installiert.
  echo Bitte zuerst von https://nodejs.org die LTS-Version installieren.
  echo.
  pause
  exit /b
)

if not exist "node_modules\" (
  echo [1/3] Pakete werden installiert ^(einmalig, bitte warten^)...
  call npm install
  echo.
)

if not exist "data.db" (
  echo [2/3] Datenbank wird angelegt und mit Daten gefuellt...
  call npm run seed
  echo.
)

echo [3/3] App wird gestartet...
echo.
echo    Oeffne im Browser:  http://localhost:3000
echo.
echo    Login Athlet: marco@be-inevitable.at / marco123
echo    Login Coach:  coach@be-inevitable.at / coach123
echo.
echo    Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
echo ============================================
echo.

start "" "http://localhost:3000"
call npm start

pause
