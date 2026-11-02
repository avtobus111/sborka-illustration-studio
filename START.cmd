@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\hermes\node\node.exe" set "PATH=%LOCALAPPDATA%\hermes\node;%PATH%"
)
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\@huggingface\transformers\package.json" (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 exit /b 1
)
node scripts/launch.mjs
if errorlevel 1 pause
