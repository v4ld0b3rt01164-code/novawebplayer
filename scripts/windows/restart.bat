@echo off
chcp 65001 >nul
title NOVA Web Player - Reiniciar

call "%~dp0config.bat"

echo.
echo ========================================
echo   NOVA Web Player - Reiniciar Servicos
echo ========================================
echo.

echo [1/3] Parando servicos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
timeout /t 1 /nobreak >nul
taskkill /F /IM cloudflared.exe >nul 2>&1
echo      Servicos parados.

echo.
echo [2/3] Aguardando 2 segundos...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Iniciando servicos...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$backend = $env:BACKEND_DIR; $stdout = Join-Path $backend 'backend.log'; $stderr = Join-Path $backend 'backend-error.log'; Start-Process -FilePath 'node.exe' -ArgumentList 'dist/index.js' -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$backend = $env:BACKEND_DIR; $stdout = Join-Path $backend 'cloudflared.log'; $stderr = Join-Path $backend 'cloudflared-error.log'; Start-Process -FilePath 'cloudflared.exe' -ArgumentList @('tunnel', 'run', $env:TUNNEL_NAME) -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr"
timeout /t 4 /nobreak >nul

echo.
echo ========================================
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo   [X] Backend: OFFLINE
) else (
    echo   [OK] Backend: online
)
tasklist | findstr "cloudflared" >nul 2>&1
if errorlevel 1 (
    echo   [X] Tunnel: OFFLINE
) else (
    echo   [OK] Tunnel: online
)
echo ========================================
echo.
echo Acesse: https://novawebplayer.app
echo.
pause
