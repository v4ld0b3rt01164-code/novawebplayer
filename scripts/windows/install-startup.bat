@echo off
chcp 65001 >nul
title NOVA Web Player - Instalar Auto-Inicializacao
call "%~dp0config.bat"

echo.
echo ========================================
echo   NOVA Web Player - Task Scheduler
echo ========================================
echo.
echo Instalando tarefas de auto-inicializacao...
echo.

echo [1/2] Criando tarefa: NOVA Start (logon)...
schtasks /Delete /TN "NOVA Web Player - Start" /F 2>nul
schtasks /Create /TN "NOVA Web Player - Start" ^
    /TR "\"%~dp0start-hidden.bat\"" ^
    /SC ONLOGON ^
    /RL HIGHEST ^
    /F
if errorlevel 1 (
    echo      ERRO ao criar tarefa de inicio.
) else (
    echo      Tarefa criada com sucesso.
)

echo.
echo [2/2] Criando tarefa: NOVA Watchdog (monitoramento)...
schtasks /Delete /TN "NOVA Web Player - Watchdog" /F 2>nul
schtasks /Create /TN "NOVA Web Player - Watchdog" ^
    /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0watchdog.ps1\"" ^
    /SC MINUTE ^
    /MO 2 ^
    /RL HIGHEST ^
    /F
if errorlevel 1 (
    echo      ERRO ao criar tarefa de watchdog.
) else (
    echo      Tarefa criada com sucesso.
)

echo.
echo [3/3] Criando tarefa: NOVA Periodic Restart (reset a cada 8h)...
schtasks /Delete /TN "NOVA Web Player - Periodic Restart" /F 2>nul
schtasks /Create /TN "NOVA Web Player - Periodic Restart" ^
    /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0periodic-restart.ps1\"" ^
    /SC DAILY ^
    /MO 1 ^
    /ST 00:00 ^
    /RI 480 ^
    /DU 24:00 ^
    /RL HIGHEST ^
    /F
if errorlevel 1 (
    echo      ERRO ao criar tarefa de restart periodico.
) else (
    echo      Tarefa criada com sucesso.
)

echo.
echo ========================================
echo Instalacao concluida!
echo.
echo - NOVA Start: inicia backend+tunnel no logon
echo - NOVA Watchdog: verifica saude a cada 2 min
echo - NOVA Periodic Restart: reinicia tudo a cada 8h
echo.
echo Para desinstalar: uninstall-startup.bat
echo ========================================
echo.
pause
