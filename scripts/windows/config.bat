@echo off
chcp 65001 >nul
::
:: Configuracao compartilhada dos scripts NOVA Web Player.
::
set "TUNNEL_NAME=novawebplayer"
set "BACKEND_PM2_NAME=nova-backend"
set "TUNNEL_PM2_NAME=nova-tunnel"
set "BACKEND_DIR=%~dp0..\..\backend"
set "ECOSYSTEM=%BACKEND_DIR%\ecosystem.windows.config.cjs"
