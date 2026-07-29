@echo off
chcp 65001 >nul
title NOVA Web Player - Iniciar

set "BACKEND_DIR=%~dp0..\..\backend"
set "ECOSYSTEM=%BACKEND_DIR%\ecosystem.windows.config.cjs"
set "BACKEND_PM2_NAME=nova-backend"
set "TUNNEL_PM2_NAME=nova-tunnel"
set "PM2_HOME=%USERPROFILE%\.pm2"

echo.
echo ========================================
echo   NOVA Web Player - Iniciar Servicos
echo ========================================
echo.

cd /d "%BACKEND_DIR%"

echo [0/3] Limpando daemon PM2 antigo...
taskkill /F /IM pm2-daemon.exe >nul 2>&1
taskkill /F /IM pm2.exe >nul 2>&1
timeout /t 1 /nobreak >nul
call npx pm2 kill >nul 2>&1
timeout /t 3 /nobreak >nul

echo [1/3] Verificando backend...
call npx pm2 jlist | findstr /C:"%BACKEND_PM2_NAME%" >nul 2>&1
if errorlevel 1 (
    echo      Iniciando backend...
    call npx pm2 start "%ECOSYSTEM%"
) else (
    call npx pm2 status | findstr /C:"%BACKEND_PM2_NAME%" | findstr /C:"online" >nul 2>&1
    if errorlevel 1 (
        echo      Reiniciando backend...
        call npx pm2 restart "%BACKEND_PM2_NAME%"
    ) else (
        echo      Backend ja esta online.
    )
)

echo.
echo [3/3] Verificando tunnel...
call npx pm2 jlist | findstr /C:"%TUNNEL_PM2_NAME%" >nul 2>&1
if errorlevel 1 (
    echo      Iniciando tunnel...
    call npx pm2 start "%ECOSYSTEM%"
) else (
    call npx pm2 status | findstr /C:"%TUNNEL_PM2_NAME%" | findstr /C:"online" >nul 2>&1
    if errorlevel 1 (
        echo      Reiniciando tunnel...
        call npx pm2 restart "%TUNNEL_PM2_NAME%"
    ) else (
        echo      Tunnel ja esta online.
    )
)

echo.
echo ========================================
call npx pm2 status
echo ========================================
echo.
echo Acesse: https://novawebplayer.app
echo.
pause