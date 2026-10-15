@echo off
setlocal
cd /d "%~dp0"
if not exist game-part1.bin (
  echo Missing game-part1.bin
  pause
  exit /b 1
)
if not exist game-part2.bin (
  echo Missing game-part2.bin
  pause
  exit /b 1
)
copy /b game-part1.bin+game-part2.bin "cybersecurity-endpoint-station.zip" >nul
if errorlevel 1 (
  echo Could not join package files.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '.\cybersecurity-endpoint-station.zip' -DestinationPath '.\game' -Force"
if errorlevel 1 (
  echo Could not extract the game package.
  pause
  exit /b 1
)
echo Game extracted to the game folder. Run game\start-game.bat
pause
