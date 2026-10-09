@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:5500"
  py -3 -m http.server 5500 -d web
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    start "" "http://localhost:5500"
    python -m http.server 5500 -d web
  ) else (
    echo Python 3 is required for the local PWA server.
    echo Alternative: open web\index.html directly in Chrome (PWA installation unavailable using file URLs).
    pause
  )
)
