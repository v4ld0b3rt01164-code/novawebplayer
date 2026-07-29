@echo off
chcp 65001 >nul
title NOVA Web Player - Parar

set "BACKEND_DIR=%~dp0..\..\backend"
set "BACKEND_PM2_NAME=nova-backend"
set "TUNNEL_PM2_NAME=nova-tunnel"
set "PM2_HOME=%USERPROFILE%\.pm2"

echo.
echo ========================================
echo   NOVA Web Player - Parar Servicos
echo ========================================
echo.

cd /d "%BACKEND_DIR%"

echo [0] Limpando daemon PM2 antigo...
taskkill /F /IM pm2-daemon.exe >nul 2>&1
taskkill /F /IM pm2.exe >nul 2>&1
timeout /t 1 /nobreak >nul
call npx pm2 kill >nul 2>&1
timeout /t 3 /nobreak >nul

echo [1/2] Parando backend...
call npx pm2 stop %BACKEND_PM2_NAME%
call npx pm2 delete %BACKEND_PM2_NAME%
echo      Backend parado.

echo.
echo [2/2] Parando tunnel...
call npx pm2 stop %TUNNEL_PM2_NAME%
call npx pm2 delete %TUNNEL_PM2_NAME%
echo      Tunnel parado.

echo.
echo ========================================
echo Todos os servicos foram encerrados.
echo ========================================
echo.
pause