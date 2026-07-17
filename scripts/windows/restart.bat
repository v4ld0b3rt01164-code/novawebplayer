@echo off
chcp 65001 >nul
title NOVA Web Player - Reiniciar

set "BACKEND_DIR=%~dp0..\..\backend"
set "ECOSYSTEM=%BACKEND_DIR%\ecosystem.windows.config.cjs"
set "BACKEND_PM2_NAME=nova-backend"
set "TUNNEL_PM2_NAME=nova-tunnel"

echo.
echo ========================================
echo   NOVA Web Player - Reiniciar Servicos
echo ========================================
echo.

echo [1/2] Parando servicos...
cd /d "%BACKEND_DIR%"
call npx pm2 stop %BACKEND_PM2_NAME%
call npx pm2 delete %BACKEND_PM2_NAME%
call npx pm2 stop %TUNNEL_PM2_NAME%
call npx pm2 delete %TUNNEL_PM2_NAME%
echo.

echo [2/2] Aguardando 3 segundos...
timeout /t 3 /nobreak

echo.
echo Iniciando servicos...
call npx pm2 start "%ECOSYSTEM%"
echo.

echo ========================================
call npx pm2 status
echo ========================================
echo.
echo Acesse: https://novawebplayer.app
echo.
pause