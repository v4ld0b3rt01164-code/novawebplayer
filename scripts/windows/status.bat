@echo off
chcp 65001 >nul
title NOVA Web Player - Status

set "BACKEND_DIR=%~dp0..\..\backend"
set "FRONTEND_DIR=%~dp0..\..\frontend"
set "PM2_HOME=%USERPROFILE%\.pm2"

echo.
echo ========================================
echo   NOVA Web Player - Status dos Servicos
echo ========================================
echo.

cd /d "%BACKEND_DIR%"

echo [1/4] Processos PM2...
echo.
call npx pm2 status
echo.

echo [2/4] Porta 3001 (backend)...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo      PORTA 3001: OFFLINE
) else (
    echo      PORTA 3001: OK (escutando)
)
echo.

echo [3/4] Frontend build...
if exist "%FRONTEND_DIR%\dist\index.html" (
    echo      Frontend: OK
) else (
    echo      Frontend: FALTANDO
)
echo.

echo [4/4] Teste de saude (health)...
curl -s -o nul -w "HTTP %%{http_code}" http://localhost:3001/api/health 2>nul
if errorlevel 1 (
    echo.
    echo      Health: FALHOU
) else (
    echo.
    echo      Health: OK
)
echo.

echo ========================================
echo   Resumo
echo ========================================
echo.

set "ERROS=0"

call npx pm2 jlist 2>nul | findstr /C:"nova-backend" >nul 2>&1
if errorlevel 1 (
    echo   [X] nova-backend: NAO ENCONTRADO
    set /a ERROS+=1
) else (
    call npx pm2 status 2>nul | findstr /C:"nova-backend" | findstr /C:"online" >nul 2>&1
    if errorlevel 1 (
        echo   [X] nova-backend: PARADO
        set /a ERROS+=1
    ) else (
        echo   [OK] nova-backend: online
    )
)

call npx pm2 jlist 2>nul | findstr /C:"nova-tunnel" >nul 2>&1
if errorlevel 1 (
    echo   [X] nova-tunnel: NAO ENCONTRADO
    set /a ERROS+=1
) else (
    call npx pm2 status 2>nul | findstr /C:"nova-tunnel" | findstr /C:"online" >nul 2>&1
    if errorlevel 1 (
        echo   [X] nova-tunnel: PARADO
        set /a ERROS+=1
    ) else (
        echo   [OK] nova-tunnel: online
    )
)

netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo   [X] porta 3001: fechada
    set /a ERROS+=1
) else (
    echo   [OK] porta 3001: aberta
)

if exist "%FRONTEND_DIR%\dist\index.html" (
    echo   [OK] frontend buildado
) else (
    echo   [X] frontend NAO buildado
    set /a ERROS+=1
)

echo.
if %ERROS%==0 (
    echo   Tudo funcionando! Acesse: https://novawebplayer.app
) else (
    echo   Encontrado(s) %ERROS% problema(s). Verifique acima.
)
echo.
echo ========================================
echo.
pause