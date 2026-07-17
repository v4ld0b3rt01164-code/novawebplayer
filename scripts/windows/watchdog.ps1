# NOVA Web Player — Watchdog
# Verifica backend e tunnel a cada 60s via PM2. Reinicia se offline.
# Executado pela Task Scheduler em background (sem janela).

$BACKEND_NAME = "nova-backend"
$TUNNEL_NAME  = "nova-tunnel"
$BACKEND_DIR  = Join-Path $PSScriptRoot "..\..\backend"
$CHECK_INTERVAL = 60
$HEALTH_URL = "http://localhost:3001/api/health"

function Write-Log {
    param([string]$Msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logDir = Join-Path $PSScriptRoot "..\.."
    $logFile = Join-Path $logDir "watchdog.log"
    $line = "[$ts] $Msg"
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

function Test-PM2Process {
    param([string]$Name)
    try {
        $json = & cmd /c "cd /d `"$BACKEND_DIR`" && npx pm2 jlist 2>nul"
        if (-not $json) { return $false }
        $procs = $json | ConvertFrom-Json -ErrorAction Stop
        $proc = $procs | Where-Object { $_.name -eq $Name }
        if ($proc -and $proc.pm2_env.status -eq "online") { return $true }
        return $false
    } catch {
        return $false
    }
}

function Test-Health {
    try {
        $res = Invoke-WebRequest -Uri $HEALTH_URL -UseBasicParsing -TimeoutSec 5
        return $res.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Log "Watchdog iniciado."

while ($true) {
    # Backend
    $backendOk = Test-PM2Process -Name $BACKEND_NAME
    if (-not $backendOk) {
        Write-Log "Backend offline. Reiniciando via PM2..."
        & cmd /c "cd /d `"$BACKEND_DIR`" && npx pm2 restart $BACKEND_NAME 2>nul"
        Start-Sleep -Seconds 5
    } elseif (-not (Test-Health)) {
        Write-Log "Backend online mas health check falhou. Reiniciando..."
        & cmd /c "cd /d `"$BACKEND_DIR`" && npx pm2 restart $BACKEND_NAME 2>nul"
        Start-Sleep -Seconds 5
    }

    # Tunnel
    $tunnelOk = Test-PM2Process -Name $TUNNEL_NAME
    if (-not $tunnelOk) {
        Write-Log "Tunnel offline. Reiniciando via PM2..."
        & cmd /c "cd /d `"$BACKEND_DIR`" && npx pm2 restart $TUNNEL_NAME 2>nul"
        Start-Sleep -Seconds 3
    }

    Start-Sleep -Seconds $CHECK_INTERVAL
}
