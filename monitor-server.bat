@echo off
setlocal
chcp 65001 >nul
title NOVA Web Player - Monitor de Servidor

rem Le apenas o arquivo local de sessoes e nunca exibe usuario ou senha.
set "NOVA_SESSIONS_FILE=%~dp0backend\sessions.json"

:loop
cls
echo ========================================
echo   NOVA Web Player - Monitor de Servidor
echo ========================================
echo.
echo Atualizacao automatica a cada 2 segundos. Pressione Ctrl+C para sair.
echo Fonte local: backend\sessions.json
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path = $env:NOVA_SESSIONS_FILE; " ^
  "if (-not (Test-Path -LiteralPath $path)) { Write-Host 'Nenhum arquivo de sessao encontrado.' -ForegroundColor Yellow; exit 0 }; " ^
  "try { $sessions = ConvertFrom-Json -InputObject ([System.IO.File]::ReadAllText($path)); if ($sessions -isnot [array]) { $sessions = @($sessions) } } catch { Write-Host 'Arquivo de sessao temporariamente indisponivel.' -ForegroundColor Yellow; exit 0 }; " ^
  "$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); " ^
  "$active = @($sessions | Where-Object { $_ -and ([int64]$_.expiresAt -gt $now) }); " ^
  "if ($active.Count -eq 0) { Write-Host 'Nenhuma sessao ativa no momento.' -ForegroundColor Yellow; exit 0 }; " ^
  "for ($i = 0; $i -lt $active.Count; $i++) { " ^
  "  $session = $active[$i]; " ^
  "  $connected = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$session.createdAt).ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss'); " ^
  "  $expires = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$session.expiresAt).ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss'); " ^
  "  Write-Host ('Sessao ativa #' + ($i + 1)) -ForegroundColor Cyan; " ^
  "  Write-Host ('Servidor conectado: ' + [string]$session.server.baseUrl) -ForegroundColor Green; " ^
  "  Write-Host ('Conectado desde: ' + $connected); " ^
  "  Write-Host ('Expira em:       ' + $expires); " ^
  "  Write-Host ''; " ^
  "}"

if /I "%NOVA_MONITOR_ONCE%"=="1" exit /b 0
timeout /t 2 /nobreak >nul
goto :loop
