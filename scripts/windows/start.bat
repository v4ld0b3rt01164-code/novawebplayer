@echo off
chcp 65001 >nul
title NOVA Web Player - Iniciar

call "%~dp0config.bat"

echo.
echo ========================================
echo   NOVA Web Player - Iniciar Servicos
echo ========================================
echo.

echo [1/3] Verificando backend...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo      Iniciando backend...
    start "nova-backend" /b cmd /c "cd /d "%BACKEND_DIR%" && node dist/index.js"
    timeout /t 4 /nobreak >nul
    netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
    if errorlevel 1 (
        echo      ERRO: Backend nao iniciou. Verifique backend\backend.log
    ) else (
        echo      Backend OK (porta 3001).
    )
) else (
    echo      Backend ja esta online.
)

echo.
echo [2/3] Verificando tunnel...
tasklist | findstr "cloudflared" >nul 2>&1
if errorlevel 1 (
    echo      Iniciando tunnel...
    start "nova-tunnel" /b cmd /c "cloudflared tunnel run %TUNNEL_NAME%"
    timeout /t 4 /nobreak >nul
    tasklist | findstr "cloudflared" >nul 2>&1
    if errorlevel 1 (
        echo      ERRO: Tunnel nao iniciou.
    ) else (
        echo      Tunnel OK.
    )
) else (
    echo      Tunnel ja esta online.
)

echo.
echo [3/3] Verificando saude...
curl -s -o nul -w "HTTP %%{http_code}" http://localhost:3001/api/health 2>nul
echo.
if errorlevel 1 (
    echo      Health: FALHOU
) else (
    echo      Health: OK
)

echo.
echo ========================================
echo.
echo Acesse: https://novawebplayer.app
echo.
pause
