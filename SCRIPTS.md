# Scripts de Operacao — Windows

Estrutura de scripts `.bat` e `.ps1` para gerenciar um projeto Node.js
servido via Cloudflare Tunnel no Windows.

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
monitor-server.bat         # Monitor local das sessoes ativas
```

## Variaveis (config.bat)

```batch
set "BACKEND_DIR=%~dp0..\..\backend"
set "FRONTEND_DIR=%~dp0..\..\frontend"
set "PID_DIR=%~dp0..\.pids"
set "TUNNEL_NAME=novawebplayer"
```

`%~dp0` resolve para o diretorio do proprio script. Ajuste os nomes
conforme seu projeto.

## Scripts

### start.bat
Verifica a porta 3001 e o processo `cloudflared`. Se necessario, inicia
`node dist/index.js` e `cloudflared tunnel run <nome>`.

### stop.bat
Encerra o processo que escuta a porta 3001 e todos os processos
`cloudflared.exe`.

### restart.bat
Para backend e tunnel, aguarda 2 segundos e inicia ambos sem janelas visiveis.
Os processos sao iniciados com `WindowStyle Hidden`; stdout e stderr ficam em
`backend\backend.log`, `backend\backend-error.log`, `backend\cloudflared.log` e
`backend\cloudflared-error.log`.

### monitor-server.bat
Executa na raiz do projeto. Le `backend\sessions.json` em modo somente leitura,
atualiza a tela a cada 2 segundos e mostra o `server.baseUrl` das sessoes nao
expiradas, junto com os horarios de conexao e expiracao. Nunca exibe usuario,
senha ou token e nao cria nenhuma rota de rede.

### status.bat
Checklist de saude:
- Porta 3001
- Processo cloudflared
- Existencia do build do frontend
- Health check HTTP (curl)

### install-startup.bat
Cria tres tarefas no Task Scheduler do Windows:
- **NOVA Start**: roda `start-hidden.bat` no logon do usuario
- **NOVA Watchdog**: roda `watchdog.ps1` a cada 2 minutos
- **NOVA Periodic Restart**: reinicia o tunnel a cada 8 horas

### uninstall-startup.bat
Remove as tarefas do Task Scheduler.

## Requisitos

- **Node.js** instalado e no PATH
- **PowerShell** e **Task Scheduler** disponiveis no Windows
- **cloudflared** no PATH (para o tunnel)
- **curl** no PATH (para health check no status.bat, opcional)

## PM2 opcional

```bash
# Local (recomendado para projetos)
cd backend
npm i pm2

# Ou global
npm i -g pm2
```

O arquivo `backend/ecosystem.windows.config.cjs` continua disponivel para quem
quiser operar o projeto via PM2, mas os scripts Windows atuais iniciam os
processos diretamente e nao dependem do PM2.

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
