@echo off
setlocal
title Quest Relay

rem Run from the repository root so node resolves relay\index.mjs and ./data.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo [Quest] Node.js was not found in PATH.
  echo Install Node 20 or newer, then run this script again.
  echo.
  pause
  exit /b 1
)

echo Starting Quest research relay...
echo Keep this window open while the phone is using it.
echo.
node relay\index.mjs

echo.
echo Relay stopped.
pause
