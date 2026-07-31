@echo off
chcp 65001 >nul
title NOVA Web Player - Status

call "%~dp0config.bat"

echo.
echo ========================================
echo   NOVA Web Player - Status dos Servicos
echo ========================================
echo.

set "ERROS=0"

echo [1/4] Porta 3001 (backend)...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo      PORTA 3001: OFFLINE
    set /a ERROS+=1
) else (
    echo      PORTA 3001: OK (escutando)
)
echo.

echo [2/4] Tunnel (cloudflared)...
tasklist | findstr "cloudflared" >nul 2>&1
if errorlevel 1 (
    echo      TUNNEL: OFFLINE
    set /a ERROS+=1
) else (
    echo      TUNNEL: OK (rodando)
)
echo.

echo [3/4] Frontend build...
if exist "%FRONTEND_DIR%\dist\index.html" (
    echo      Frontend: OK
) else (
    echo      Frontend: FALTANDO
    set /a ERROS+=1
)
echo.

echo [4/4] Teste de saude (health)...
for /f "delims=" %%i in ('curl -s -o nul -w "HTTP %%{http_code}" http://localhost:3001/api/health 2^>nul') do set "HEALTH=%%i"
if defined HEALTH (
    echo      Health: %HEALTH%
) else (
    echo      Health: FALHOU
    set /a ERROS+=1
)
echo.

echo ========================================
echo   Resumo
echo ========================================
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
