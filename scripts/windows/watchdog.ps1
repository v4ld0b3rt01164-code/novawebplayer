# NOVA Web Player — Watchdog
# Verifica backend e tunnel a cada 60s. Reinicia se offline.
# Executado pela Task Scheduler em background (sem janela).

$BACKEND_DIR  = Join-Path $PSScriptRoot "..\..\backend"
$PID_DIR      = Join-Path $PSScriptRoot "..\..\.pids"
$BACKEND_PID  = Join-Path $PID_DIR "backend.pid"
$TUNNEL_PID   = Join-Path $PID_DIR "tunnel.pid"
$CHECK_INTERVAL = 60
$HEALTH_URL   = "http://localhost:3001/api/health"
$TUNNEL_NAME  = "novawebplayer"

function Write-Log {
    param([string]$Msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logDir = Join-Path $PSScriptRoot "..\.."
    $logFile = Join-Path $logDir "watchdog.log"
    $line = "[$ts] $Msg"
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

function Test-TunnelProcess {
    $proc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    return [bool]$proc
}

function Start-Backend {
    Write-Log "Iniciando backend..."
    Push-Location $BACKEND_DIR
    Start-Process -FilePath "node" -ArgumentList "dist/index.js" `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$BACKEND_DIR\backend.log" `
        -RedirectStandardError "$BACKEND_DIR\backend-err.log"
    Pop-Location
    Start-Sleep -Seconds 3
    if (Test-BackendPort) {
        Write-Log "Backend iniciado com sucesso."
        return $true
    }
    Write-Log "ERRO: Backend nao iniciou."
    return $false
}

function Start-Tunnel {
    Write-Log "Iniciando tunnel..."
    Start-Process -FilePath "cloudflared" -ArgumentList "tunnel run $TUNNEL_NAME" `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$BACKEND_DIR\tunnel.log" `
        -RedirectStandardError "$BACKEND_DIR\tunnel-err.log"
    Start-Sleep -Seconds 3
    if (Test-TunnelProcess) {
        Write-Log "Tunnel iniciado com sucesso."
        return $true
    }
    Write-Log "ERRO: Tunnel nao iniciou."
    return $false
}

Write-Log "Watchdog iniciado."

while ($true) {
    # Backend
    $backendUp = (Test-BackendPort) -and (Test-Health)
    if (-not $backendUp) {
        Write-Log "Backend offline (porta ou health falhou). Reiniciando..."
        # Mata processos antigos
        if (Test-BackendPort) {
            $pids = netstat -ano | Select-String ":3001.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] }
            foreach ($pid in $pids) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
        }
        Start-Backend
    }

    # Tunnel
    $tunnelUp = Test-TunnelProcess
    if (-not $tunnelUp) {
        Write-Log "Tunnel offline. Reiniciando..."
        Start-Tunnel
    }

    Start-Sleep -Seconds $CHECK_INTERVAL
}
