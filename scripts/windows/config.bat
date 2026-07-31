@echo off
chcp 65001 >nul
::
:: Configuracao compartilhada dos scripts NOVA Web Player.
::
set "BACKEND_DIR=%~dp0..\..\backend"
set "FRONTEND_DIR=%~dp0..\..\frontend"
set "PID_DIR=%~dp0..\..\.pids"
set "BACKEND_PID=%PID_DIR%\backend.pid"
set "TUNNEL_PID=%PID_DIR%\tunnel.pid"
set "TUNNEL_NAME=novawebplayer"
