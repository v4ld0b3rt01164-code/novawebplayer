# Scripts de Operacao — Windows

Estrutura de scripts `.bat` para gerenciar servicos de um projeto Node.js
servido via PM2 + Cloudflare Tunnel no Windows.

## Estrutura

```
scripts/windows/
  config.bat               # Variaveis compartilhadas
  start.bat                # Inicia servicos
  stop.bat                 # Para servicos
  restart.bat              # Para e reinicia
  status.bat               # Verifica saude
  start-hidden.bat         # Inicio silencioso (Task Scheduler)
  install-startup.bat      # Instala auto-inicializacao
  uninstall-startup.bat    # Remove auto-inicializacao
  watchdog.ps1             # Monitor PowerShell (opcional)
  periodic-restart.ps1     # Restart inteligente a cada 8h (tunnel so se backend healthy)
```

## Variaveis (config.bat)

```batch
set "BACKEND_DIR=%~dp0..\..\backend"
set "ECOSYSTEM=%BACKEND_DIR%\ecosystem.windows.config.cjs"
set "BACKEND_PM2_NAME=nova-backend"
set "TUNNEL_PM2_NAME=nova-tunnel"
```

`%~dp0` resolve para o diretorio do proprio script. Ajuste os nomes
conforme seu projeto.

## Scripts

### start.bat
Verifica se cada processo PM2 esta rodando. Se nao, inicia via
`ecosystem.windows.config.cjs`. Se ja esta parado, reinicia.

### stop.bat
Para e deleta todos os processos PM2 (`pm2 stop` + `pm2 delete`).

### restart.bat
Para tudo, aguarda 3 segundos, inicia via ecosystem.

### status.bat
Checklist de saude:
- Tabela PM2
- Porta do backend (netstat)
- Existencia do build do frontend
- Health check HTTP (curl)

### install-startup.bat
Cria tres tarefas no Task Scheduler do Windows:
- **NOVA Start**: roda `start-hidden.bat` no logon do usuario
- **NOVA Watchdog**: roda `watchdog.ps1` a cada 2 minutos
- **NOVA Periodic Restart**: roda `periodic-restart.ps1` a cada 8 horas.
  Reset preventivo: se o backend estiver healthy, reinicia apenas o
  tunnel (sessoes em memoria preservadas). Se unhealthy, reinicia tudo
  (sessoes sobrevivem em disco via `backend/sessions.json`). Nao
  substitui o watchdog (que detecta quedas imediatas) — apenas
  evita estados inconsistentes acumulados do tunnel.

### uninstall-startup.bat
Remove as tarefas do Task Scheduler.

## Requisitos

- **Node.js** instalado e no PATH
- **PM2** acessivel via `npx pm2` (instalado localmente em node_modules)
  ou globalmente (`npm i -g pm2`)
- **cloudflared** no PATH (para o tunnel)
- **curl** no PATH (para health check no status.bat, opcional)

## Instalacao PM2

```bash
# Local (recomendado para projetos)
cd backend
npm i pm2

# Ou global
npm i -g pm2
```

Se PM2 esta local, os scripts usam `call npx pm2` para encontrar.

## Ecosystem (ecosystem.windows.config.cjs)

```js
module.exports = {
  apps: [
    {
      name: 'nova-backend',
      script: './dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3001 },
      autorestart: true,
      max_memory_restart: '500M',
      max_restarts: 50,
      min_uptime: '5s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'nova-tunnel',
      script: 'cloudflared',
      args: 'tunnel run novawebplayer',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      min_uptime: '5s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 500,
      max_memory_restart: '200M',
    },
  ],
}
```

## Cloudflare Tunnel

```yaml
# ~/.cloudflared/config.yml
tunnel: <UUID>
credentials-file: ~/.cloudflared/<UUID>.json
ingress:
  - hostname: novawebplayer.app
    service: http://localhost:3001
  - service: http_status:404
```

## Watchdog (watchdog.ps1)

PowerShell que roda em loop infinito a cada 60 segundos:
- Verifica se PM2 esta rodando (`pm2 jlist`)
- Verifica se o backend responde no health endpoint
- Reinicia processos parados
- Log em `watchdog.log`

## Notas Windows

- **BOM UTF-8**: O Write tool do opencode salva com BOM. Reescreva
  os `.bat` sem BOM usando PowerShell:
  ```powershell
  [System.IO.File]::WriteAllText("arquivo.bat", $conteudo, (New-Object System.Text.UTF8Encoding $false))
  ```
- **Caracteres UTF-8**: Evite `─`, `═`, `—` nos `.bat`. Use `=`, `-`.
- **`call npx`**: Use `call npx pm2` em vez de `npx pm2` nos `.bat`.
  Sem `call`, o batch pode nao esperar o comando terminar.
- **`2>nul` vs `2>&1`**: `2>nul` esconde erros. Use apenas quando
  quiser silenciar saida de erro intencionalmente.
- **Workaround do `%~dp0`**: Sempre defina `BACKEND_DIR` baseado em
  `%~dp0` e faca `cd /d` antes dos comandos.
