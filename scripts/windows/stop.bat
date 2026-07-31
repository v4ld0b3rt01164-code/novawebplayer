@echo off
chcp 65001 >nul
title NOVA Web Player - Parar

call "%~dp0config.bat"

echo.
echo ========================================
echo   NOVA Web Player - Parar Servicos
echo ========================================
echo.

echo [1/2] Parando backend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo      Backend parado.

echo.
echo [2/2] Parando tunnel...
taskkill /F /IM cloudflared.exe >nul 2>&1
timeout /t 1 /nobreak >nul
taskkill /F /IM cloudflared.exe >nul 2>&1
echo      Tunnel parado.

echo.
echo ========================================
echo Todos os servicos foram encerrados.
echo ========================================
echo.
pause
