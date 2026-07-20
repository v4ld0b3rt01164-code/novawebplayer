@echo off
chcp 65001 >nul
title NOVA Web Player - Desinstalar Auto-Inicializacao

echo.
echo ========================================
echo   NOVA Web Player - Remover Tarefas
echo ========================================
echo.

echo [1/2] Removendo tarefa: NOVA Start...
schtasks /Delete /TN "NOVA Web Player - Start" /F 2>nul
if errorlevel 1 (
    echo      Nao encontrada ou ja removida.
) else (
    echo      Removida.
)

echo.
echo [2/2] Removendo tarefa: NOVA Watchdog...
schtasks /Delete /TN "NOVA Web Player - Watchdog" /F 2>nul
if errorlevel 1 (
    echo      Nao encontrada ou ja removida.
) else (
    echo      Removida.
)

echo.
echo [3/3] Removendo tarefa: NOVA Periodic Restart...
schtasks /Delete /TN "NOVA Web Player - Periodic Restart" /F 2>nul
if errorlevel 1 (
    echo      Nao encontrada ou ja removida.
) else (
    echo      Removida.
)

echo.
echo ========================================
echo Auto-inicializacao desinstalada.
echo ========================================
echo.
pause
