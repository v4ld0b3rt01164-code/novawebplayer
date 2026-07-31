@echo off
chcp 65001 >nul
call "%~dp0config.bat"

start "nova-backend" /b cmd /c "cd /d "%BACKEND_DIR%" && node dist/index.js"
timeout /t 3 /nobreak >nul
start "nova-tunnel" /b cmd /c "cloudflared tunnel run %TUNNEL_NAME%"
