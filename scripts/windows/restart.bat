@echo off
chcp 65001 >nul
title NOVA Web Player - Reiniciar

set "BACKEND_DIR=%~dp0..\..\backend"
set "ECOSYSTEM=%BACKEND_DIR%\ecosystem.windows.config.cjs"
set "BACKEND_PM2_NAME=nova-backend"
set "TUNNEL_PM2_NAME=nova-tunnel"
set "PM2_HOME=%USERPROFILE%\.pm2"

echo.
echo ========================================
echo   NOVA Web Player - Reiniciar Servicos
echo ========================================
echo.

cd /d "%BACKEND_DIR%"

echo [0/3] Limpando daemon PM2 antigo...
taskkill /F /IM pm2-daemon.exe >nul 2>&1
taskkill /F /IM pm2.exe >nul 2>&1
timeout /t 1 /nobreak >nul
call npx pm2 kill >nul 2>&1
timeout /t 3 /nobreak >nul

echo [1/3] Aguardando 2 segundos...
timeout /t 2 /nobreak

echo.
echo [2/3] Iniciando servicos...
call npx pm2 start "%ECOSYSTEM%"
echo.

echo ========================================
call npx pm2 status
echo ========================================
echo.
echo Acesse: https://novawebplayer.app
echo.
pause