@echo off
setlocal
chcp 65001 >nul
title Cybersecurity Endpoint Station
cd /d "%~dp0"
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" --version >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.5 or newer and try again.
  pause
  exit /b 1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "127.0.0.1:3000" ^| findstr "LISTENING"') do set "GAME_PID=%%a"
if defined GAME_PID (
  echo The game is already running at http://127.0.0.1:3000/
  start "" http://127.0.0.1:3000/
  exit /b 0
)
start "" cmd /c "timeout /t 2 /nobreak ^>nul ^& start http://127.0.0.1:3000"
"%NODE_EXE%" --no-warnings server.js
echo.
echo The game server has stopped. Press any key to close this window.
pause >nul
