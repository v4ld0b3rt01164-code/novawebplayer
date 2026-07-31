# NOVA Web Player — Restart Periodico (Tunnel)
# Reinicia apenas o tunnel a cada 8h para evitar estados inconsistentes.
# O backend NAO e reiniciado — sessoes em memoria sao preservadas.
# Se o backend estiver unhealthy, reinicia tudo.
# Executado pela Task Scheduler em background (sem janela).

$BACKEND_DIR  = Join-Path $PSScriptRoot "..\..\backend"
$TUNNEL_NAME  = "novawebplayer"
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

function Test-BackendPort {
    $listening = netstat -ano | Select-String ":3001.*LISTENING"
    return [bool]$listening
}

function Restart-Tunnel {
    # Mata tunnel atual
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    # Inicia tunnel novo
    Start-Process -FilePath "cloudflared" -ArgumentList "tunnel run $TUNNEL_NAME" `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$BACKEND_DIR\tunnel.log" `
        -RedirectStandardError "$BACKEND_DIR\tunnel-err.log"
    Start-Sleep -Seconds 3
}

function Restart-Backend {
    # Mata backend atual
    if (Test-BackendPort) {
        $pids = netstat -ano | Select-String ":3001.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] }
        foreach ($pid in $pids) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
    }
    Start-Sleep -Seconds 2
    # Inicia backend novo
    Push-Location $BACKEND_DIR
    Start-Process -FilePath "node" -ArgumentList "dist/index.js" `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$BACKEND_DIR\backend.log" `
        -RedirectStandardError "$BACKEND_DIR\backend-err.log"
    Pop-Location
    Start-Sleep -Seconds 3
}

Write-Log "Inicio do restart periodico."

$backendHealthy = (Test-BackendPort) -and (Test-Health)

if ($backendHealthy) {
    # Backend OK — reiniciar apenas o tunnel
    Write-Log "Backend healthy. Reiniciando apenas o tunnel..."
    Restart-Tunnel
    Write-Log "Tunnel reiniciado."
} else {
    # Backend unhealthy — reiniciar tudo
    Write-Log "Backend unhealthy. Reiniciando tudo..."
    Restart-Backend
    Restart-Tunnel
    Start-Sleep -Seconds 5

    if ((Test-BackendPort) -and (Test-Health)) {
        Write-Log "Restart completo. Health OK."
    } else {
        Write-Log "Restart completo, mas health check falhou."
    }
}

Write-Log "Fim do restart periodico."
