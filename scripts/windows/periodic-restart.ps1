# NOVA Web Player — Restart Periodico (Tunnel)
# Reinicia apenas o tunnel a cada 8h para evitar estados inconsistentes.
# O backend NÃO é reiniciado — sessões em memória são preservadas.
# Se o backend estiver unhealthy, reinicia tudo (sessões sobrevivem em disco).
# Executado pela Task Scheduler em background (sem janela).

$BACKEND_NAME = "nova-backend"
$TUNNEL_NAME  = "nova-tunnel"
$BACKEND_DIR  = Join-Path $PSScriptRoot "..\..\backend"
$ECOSYSTEM    = Join-Path $BACKEND_DIR "ecosystem.windows.config.cjs"
$HEALTH_URL   = "http://localhost:3001/api/health"

function Write-Log {
    param([string]$Msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logDir = Join-Path $PSScriptRoot "..\.."
    $logFile = Join-Path $logDir "watchdog.log"
    $line = "[$ts] [PERIODIC] $Msg"
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

function Test-Health {
    try {
        $res = Invoke-WebRequest -Uri $HEALTH_URL -UseBasicParsing -TimeoutSec 5
        return $res.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Log "Inicio do restart periodico."

$backendHealthy = Test-Health

if ($backendHealthy) {
    # Backend OK — reiniciar apenas o tunnel
    Write-Log "Backend healthy. Reiniciando apenas o tunnel..."
    & cmd /c "cd /d `"$BACKEND_DIR`" && npx pm2 restart $TUNNEL_NAME 2>nul"
    Start-Sleep -Seconds 3
    Write-Log "Tunnel reiniciado."
} else {
    # Backend unhealthy — reiniciar tudo
    Write-Log "Backend unhealthy. Reiniciando tudo..."
    & cmd /c "cd /d `"$BACKEND_DIR`" && npx pm2 restart $BACKEND_NAME 2>nul"
    Start-Sleep -Seconds 3
    & cmd /c "cd /d `"$BACKEND_DIR`" && npx pm2 restart $TUNNEL_NAME 2>nul"
    Start-Sleep -Seconds 5

    if (Test-Health) {
        Write-Log "Restart completo. Health OK."
    } else {
        Write-Log "Restart completo, mas health check falhou."
    }
}

Write-Log "Fim do restart periodico."
