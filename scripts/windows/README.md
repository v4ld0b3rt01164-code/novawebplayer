# Scripts Windows — NOVA Web Player

Pasta: `scripts/windows/`

## Pré-requisitos

- Node.js instalado.
- Backend buildado:
  ```powershell
  cd backend
  npm run build
  ```
- **pm2** instalado globalmente:
  ```powershell
  npm install -g pm2
  ```
- **cloudflared** instalado e autenticado:
  ```powershell
  cloudflared tunnel list
  ```

## Configuração

Edite o arquivo `config.bat` e altere:

```bat
set "TUNNEL_NAME=SEU_TUNNEL_AQUI"
```

Coloque o **nome do túnel** que aparece no comando `cloudflared tunnel list`.

## Uso manual

Execute na ordem:

- **Iniciar servidor + túnel:** `start.bat`
- **Parar servidor + túnel:** `stop.bat`
- **Reiniciar servidor + túnel:** `restart.bat`

## Inicialização automática no logon do Windows

Execute **uma vez** com privilégios normais:

```powershell
.\scripts\windows\install-startup.bat
```

Isso cria 3 tarefas no Task Scheduler:

- **NOVA Start**: inicia backend+tunnel no logon do Windows.
- **NOVA Watchdog**: verifica saúde a cada 2 minutos, reinicia se offline.
- **NOVA Periodic Restart**: roda `periodic-restart.ps1` a cada 8 horas.
  Reset preventivo: se o backend estiver healthy, reinicia apenas o
  tunnel (sessões em memória preservadas). Se unhealthy, reinicia tudo
  (sessões sobrevivem em disco via `backend/sessions.json`). Não
  substitui o watchdog — apenas evita estados inconsistentes acumulados
  do tunnel.

Para remover:

```powershell
.\scripts\windows\uninstall-startup.bat
```

## Atalho na área de trabalho

Para criar um atalho na área de trabalho que execute um dos scripts:

1. Clique com botão direito na área de trabalho → **Novo** → **Atalho**.
2. Aponte para o `.bat` desejado (ex.: `scripts\windows\restart.bat`).
3. Dê um nome (ex.: "NOVA Restart").
4. **Importante:** Não marque "Executar como administrador" — isso mudaria a sessão Windows e causaria o erro `EPERM \\.\pipe\rpc.sock` no PM2.

Se o atalho já existir e der o erro `EPERM`, verifique as propriedades do atalho e desmarque "Executar como administrador" se estiver habilitado.

## Observações

- O frontend é servido pelo próprio backend a partir de `backend/../frontend/dist` (mesma origem HTTPS: `novawebplayer.app`). Por isso, em produção, **não é necessário iniciar o Vite separadamente**.
- `stop.bat` encerra todos os processos `cloudflared.exe`. Se você executa outros túneis no mesmo usuário, pare-os manualmente com `cloudflared tunnel stop <nome>`.
- Para ver logs do backend: `pm2 logs nova-backend`.
