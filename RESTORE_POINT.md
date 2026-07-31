# RESTORE POINT — NOVA WEB PLAYER

**Data**: 2026-07-31 (monitor local + restart sem janelas visiveis)
**Status**: FUNCIONANDO (desktop + mobile, live + VOD + series + fallback stream + fallback transcode + Favoritos + login aleatorio + monitor local)
**Checkpoint git**: `checkpoint-2026-07-31-monitor`
**Nota conhecida**: Botao maximizar series mobile so rotaciona a tela (nao vai fullscreen nativo).

---

## Ponto de restauracao (git)

O projeto e versionado com git (repositorio local, sem remote). Cada estado
estavel recebe uma tag `checkpoint-AAAA-MM-DD`. O commit inclui os builds
(`backend/dist` e `frontend/dist`) de proposito, para a restauracao ser
imediata (so `npm install` + `pm2 restart`, sem rebuild obrigatorio).

### Restaurar para este checkpoint

```powershell
cd C:\Users\Valdo\Desktop\TUDO\SITES\DEV\NOVAWEBPLAYER

# 1. Ver o que mudou desde o checkpoint (opcional)
git status
git diff checkpoint-2026-07-31-monitor

# 2. Guardar mudancas atuais em andamento (opcional, recuperavel depois)
git stash push -u -m "antes de restaurar"

# 3. Voltar TODO o codigo ao estado do checkpoint (descarta mudancas!)
git reset --hard checkpoint-2026-07-31-monitor

# 4. Restaurar dependencias exatas e reiniciar
cd backend; npm install; cd ..
cd frontend; npm install; cd ..
scripts\windows\restart.bat
```

**Checkpoints existentes** (do mais novo para o mais antigo):

| Tag | Estado |
|---|---|
| `checkpoint-2026-07-31-monitor` | Login aleatorio entre 8 dominios + monitor local de sessoes + restart sem janelas visiveis |
| `checkpoint-2026-07-31` | Login com ordem aleatoria segura entre os 8 dominios + fallback preservado; builds do backend atualizados |
| `0d25c7a` | Favoritos em Live, Movies e Series — singleton compartilhado + endpoints com category_id opcional |
| `checkpoint-2026-07-18` | player fixo no topo SeriesScreen desktop (fixed inset-0 z-50) + useIsDesktopViewport evita 2 VideoPlayers |
| `checkpoint-2026-07-17-transcode-fallback` | + fallback automatico /stream -> /transcode no player (iOS AC3/EAC3 + heuristica "toca mudo") |
| `checkpoint-2026-07-17` | seguranca: path traversal corrigido + rate limiting + trustProxy |

### Criar um novo checkpoint (apos validar que tudo funciona)

```powershell
git add -A
git commit -m "Checkpoint: <descricao do estado>"
git tag -a checkpoint-AAAA-MM-DD -m "<resumo do que funciona>"
git tag   # listar checkpoints existentes
```

**Regras**: nunca criar checkpoint com o site quebrado; sempre buildar
frontend + backend antes (`npm run build` em cada um) para o `dist/`
commitado corresponder ao codigo-fonte.

---

## Arquitetura

```
[Navegador] --HTTPS--> novawebplayer.app --[Cloudflare Tunnel]--> [Backend local :3001]
                                                                          |
                                                                          v
                                                              [Painel IPTV via HTTP]
                                                              (liderpremium.xyz)
```

- Frontend React servido pelo proprio backend (mesma origem)
- Backend Fastify como proxy reverso de API + streams
- PM2 gerencia 2 processos: nova-backend + nova-tunnel
- Cloudflare Tunnel expoe localhost:3001 em novawebplayer.app

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite 8 + TailwindCSS 4 + hls.js |
| Backend | Node.js + Fastify 5 + TypeScript 6 |
| Player | `<video>` nativo + hls.js (live) |
| Deploy | PM2 + Cloudflare Tunnel |
| Auth | UUID token persistido em disco (24h TTL) |

## O que funciona

- [x] Login com ordem aleatoria e fallback entre 8 dominios IPTV (`crypto.randomInt` + Fisher-Yates)
- [x] Monitor local de sessoes em `monitor-server.bat` (somente `server.baseUrl`, sem credenciais)
- [x] **Fallback em tempo real durante streaming** (re-autenticacao automatica em 401/403)
- [x] TV ao vivo (HLS via proxy com descoberta de servidor real)
- [x] **Auto-play primeiro canal ao entrar na pasta** (miniplayer ja inicia reproduzindo)
- [x] **Layout split fixo TV ao vivo** (player + EPG travados, coluna canais rola com scrollbar propria)
- [x] Layout TV ao vivo desktop: canais esquerda (scroll) + player 50% direita
- [x] Botao maximizar/minimizar no player (live, filmes, series)
- [x] Filmes VOD (mp4 via proxy com Range requests)
- [x] Layout filmes desktop: info filme esquerda (poster, sinopse, elenco) + player 50% direita
- [x] Series/Novelas (mp4 via proxy com Range requests)
- [x] **Layout mobile series**: poster+sinopse topo → miniplayer → temporadas+episodios (scroll)
- [x] **renderMode** no SeriesDetailContent: `poster` | `episodes` | `all`
- [x] Layout series desktop: detalhe serie esquerda (poster, temporadas, episodios scroll) + player 50% direita
- [x] Menu responsivo com SVG icons (sem moldura, fundo transparente)
- [x] Menu mobile: 3 colunas lado a lado, todos visiveis sem scroll
- [x] Busca em filmes e series
- [x] EPG basico (mini guia no player)
- [x] Container fixo na viewport (fixed inset-0 z-50) para splits
- [x] Scripts Windows (start/stop/restart/status)
- [x] Auto inicializacao via Task Scheduler
- [x] **Static serving seguro** (@fastify/static; path traversal bloqueado com 403)
- [x] **Rate limiting** (300 req/min global + 5 req/min em POST /api/auth, por IP real via trustProxy)
- [x] **index.html sempre no-store** (hook onSend forca em text/html; assets com hash mantem cache 30d)
- [x] **Fallback automatico para transcode** (erro de codec no <video>/hls.js OU "toca mudo" no iOS/WebKit -> troca para /transcode/... ffmpeg H.264/AAC, 1x por sessao de reproducao)
- [x] **Sessao persistida em disco** (sessions.json com debounced write, sobrevive a restarts do backend)

---

## Estrutura de arquivos criticos

```
NOVAWEBPLAYER/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Fastify bootstrap + @fastify/static + rate limit + trustProxy
│   │   ├── iptv/
│   │   │   ├── servers.ts              # Lista dos 8 dominios candidatos
│   │   │   ├── auth.ts                 # Ordem aleatoria + fallback Xtream (+ excludeBaseUrls)
│   │   │   ├── catalog.ts              # Proxy de catalogo
│   │   │   ├── epg.ts                  # Parse xmltv + cache 30min
│   │   │   ├── proxy.ts                # Proxy de streams + UpstreamHttpError
│   │   │   ├── reauth.ts               # Re-autenticacao com single-flight
│   │   │   ├── withFallback.ts         # Wrapper de fallback para streams
│   │   │   └── categoryOrder.ts        # Ordenacao de categorias
│   │   ├── routes/
│   │   │   ├── auth.ts                 # POST /api/auth
│   │   │   ├── stream.ts               # GET /stream/:type/:file + /seg/ (com fallback)
│   │   │   ├── streamAuth.ts           # Auth via header ou ?token=
│   │   │   ├── live.ts                 # /api/live/*
│   │   │   ├── movies.ts               # /api/movies/*
│   │   │   ├── series.ts               # /api/series/*
│   │   │   ├── epg.ts                  # /api/epg/*
│   │   │   └── middleware.ts           # requireAuth
│   │   └── session/
│   │       └── store.ts                # Sessoes persistidas em disco (sessions.json) + blockedServers + updateSessionServer
│   ├── ecosystem.windows.config.cjs    # PM2 config (Windows)
│   └── dist/                           # Build do backend
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts               # HTTP client (fala so com backend)
│   │   │   └── streamUrl.ts            # URLs /stream/... + /transcode/... com token
│   │   ├── player/
│   │   │   └── VideoPlayer.tsx          # Player unificado (HLS + MP4) + fallback transcode
│   │   ├── features/
│   │   │   ├── auth/LoginScreen.tsx
│   │   │   ├── menu/MenuScreen.tsx
│   │   │   ├── live/LiveScreen.tsx     # Auto-play + fixed split
│   │   │   ├── movies/MoviesScreen.tsx
│   │   │   └── series/SeriesScreen.tsx # renderMode poster/episodes/all + fixed split
│   │   └── shared/                     # Header, Loading, ErrorState
│   ├── dist/                           # Build do frontend
│   └── scripts/
│       └── strip-crossorigin.cjs       # Remove crossorigin do build
├── scripts/windows/
│   ├── config.bat                      # Variaveis compartilhadas
│   ├── start.bat                       # Inicia servicos
│   ├── stop.bat                        # Para servicos
│   ├── restart.bat                     # Reinicia servicos
│   ├── status.bat                      # Verifica saude
│   ├── start-hidden.bat                # Inicio silencioso
│   ├── install-startup.bat             # Task Scheduler
│   ├── uninstall-startup.bat           # Remove Task Scheduler
│   ├── watchdog.ps1                    # Monitor PowerShell
│   └── periodic-restart.ps1            # Restart inteligente (tunnel a cada 8h)
├── monitor-server.bat                    # Monitor local de servidores das sessoes ativas
├── AGENTS.md                           # Regras para agentes de cod
├── PRD.md                              # Requisitos do projeto
├── SCRIPTS.md                          # Docs dos scripts Windows
└── RESTORE_POINT.md                    # Este arquivo
```

---

## Como funciona o proxy de streams

### Live (HLS)

1. Frontend pede `/stream/live/217275.m3u8?token=xxx`
2. Backend busca m3u8 do upstream (`liderpremium.xyz/live/user/pass/217275.m3u8`)
3. Backend reescreve URLs dos segmentos para `/stream/seg/live/217275.m3u8/...`
4. Backend armazena IP real do servidor (descoberto via redirect do `.ts`)
5. Frontend (hls.js) pede segmentos ao backend
6. Backend busca segmentos do IP real (Cloudflare bloqueia `/hls/...`)

### VOD/Series (mp4)

1. Frontend pede `/stream/movie/722955.mp4?token=xxx`
2. Backend detecta extensao `.mp4` (nao e m3u8)
3. Backend busca mp4 do upstream com suporte a Range requests
4. Backend retorna stream com headers `Accept-Ranges: bytes`
5. Browser usa `<video>` nativo (sem hls.js)

### Descoberta do servidor real

O Cloudflare bloqueia requests GET para `/hls/...` (retorna 403/404).
Solucao: o backend faz request para `/live/user/pass/ID.ts` com
`redirect: 'manual'`, le o header `Location` que aponta para o IP
real (ex: `http://130.250.188.105:80/...`), cacheia esse IP, e usa
para buscar segmentos.

### Fallback em tempo real (re-autenticacao)

Quando o upstream retorna 401/403 em qualquer chamada de stream
(playlist .m3u8, arquivo raw, ou segmento .ts), o backend:

1. **Detecta** via `UpstreamHttpError` (classe tipada em `proxy.ts`)
2. **Re-autentica** em ordem aleatoria nos dominios restantes (excluindo os ja bloqueados)
3. **Atualiza** `session.server` com o novo dominio (mesmo token UUID)
4. **Repete** a chamada original uma unica vez

**Single-flight**: se multiplos .ts retornam 403 ao mesmo tempo (hls.js
pede varios em paralelo), somente uma re-autenticacao e disparada — as
demais aguardam a mesma Promise.

**Arquivos envolvidos**:
- `iptv/proxy.ts` — `UpstreamHttpError` class (401/403 tipados)
- `iptv/reauth.ts` — `reauthenticateSession()` com deduplicacao
- `iptv/withFallback.ts` — `withUpstreamFallback()` wrapper
- `iptv/auth.ts` — `authenticate()` com ordem aleatoria e param `excludeBaseUrls`
- `session/store.ts` — `blockedServers` Set + `updateSessionServer()`
- `routes/stream.ts` — handlers envoltos com `withUpstreamFallback()`

### Fallback de compatibilidade (transcode ffmpeg)

Quando o NAVEGADOR (nao o upstream) nao consegue reproduzir a fonte
direta `/stream/...`, o player troca automaticamente para
`/transcode/...` (ffmpeg -> HLS H.264/AAC), uma unica vez por sessao de
reproducao (`triedFallbackRef`):

1. **Erro real de midia**: `error` do `<video>` com code 3
   (MEDIA_ERR_DECODE) ou 4 (MEDIA_ERR_SRC_NOT_SUPPORTED); no hls.js,
   MEDIA_ERROR fatal com retries esgotados ou OTHER_ERROR fatal.
2. **Heuristica "toca mudo" (so WebKit/iOS)**: video H.264 + audio
   AC3/EAC3 toca SEM erro no iOS, descartando o audio. Detectado via
   `webkitAudioDecodedByteCount === 0` apos 3s de reproducao ativa
   (desmutado, nao pausado, currentTime avancando). Propriedade so
   existe no WebKit -> zero falso positivo em Chrome/Firefox/Android.

A tela de erro so aparece se a fonte direta E o transcode falharem.
"Tentar novamente" volta para a fonte direta (reseta a sessao).

**IMPORTANTE**: `/transcode/:type/:file` responde SEMPRE playlist HLS,
mesmo com `.mp4`/`.mkv` no path — o player trata qualquer URL
`/transcode/` como HLS independente da extensao.

**Arquivos envolvidos**:
- `frontend/src/api/streamUrl.ts` — `liveTranscodeUrl()`, `movieTranscodeUrl()`, `seriesTranscodeUrl()`
- `frontend/src/player/VideoPlayer.tsx` — prop `fallbackSrc`, `tryFallback()`, sonda de audio WebKit
- `frontend/src/features/{live,movies,series}/*Screen.tsx` — passam `fallbackSrc` aos 7 `<VideoPlayer>`
- `backend/src/iptv/transcode.ts` + `backend/src/routes/transcode.ts` — pipeline ffmpeg (ja existia)

---

## Configuracao

### Backend (env vars)

```
PORT=3001
HOST=127.0.0.1
NODE_ENV=production
```

### Cloudflare Tunnel

```yaml
# C:\Users\Valdo\.cloudflared\config.yml
tunnel: aed0ffcf-8f79-42c5-8e6e-5ed18460189f
credentials-file: C:\Users\Valdo\.cloudflared\aed0ffcf-8f79-42c5-8e6e-5ed18460189f.json
ingress:
  - hostname: novawebplayer.app
    service: http://localhost:3001
  - service: http_status:404
```

### PM2 ecosystem

```javascript
// ecosystem.windows.config.cjs
apps: [
  { name: 'nova-backend', script: './dist/index.js', cwd: __dirname },
  { name: 'nova-tunnel', script: 'cloudflared', args: 'tunnel run novawebplayer' },
]
```

---

## Credenciais de teste

```
username: webplay
password: 11223344
Painel: liderpremium.xyz
```

---

## Comandos uteis

```bash
# Status
pm2 list
pm2 logs nova-backend --lines 20

# Reiniciar
pm2 restart nova-backend

# Rebuild frontend
cd frontend && npm run build

# Rebuild backend
cd backend && npm run build

# Validacoes backend
cd backend && npm run typecheck
cd backend && npm run lint

# Monitor local de sessoes
monitor-server.bat

# Build completo (frontend + backend)
cd frontend && npm run build && cd ../backend && npm run build && pm2 restart nova-backend

# Checkpoints (git)
git tag                                  # listar checkpoints
git log --oneline -10                    # ultimos commits
git reset --hard checkpoint-2026-07-18   # RESTAURAR (descarta mudancas!)
```

---

## Armadilhas conhecidas

1. **BOM UTF-8 em .bat**: O Write tool salva com BOM. Reescrever sem BOM:
   ```powershell
   [System.IO.File]::WriteAllText("file.bat", $content, (New-Object System.Text.UTF8Encoding $false))
   ```

2. **Caracteres UTF-8 em .bat**: Evitar `─`, `═`, `—`. Usar `=`, `-`.

3. **`call npx`**: Usar `call npx pm2` nos .bat, senao o batch nao espera.

4. **Cloudflare bloqueia /hls/**: Segmentos so funcionam via IP real descoberto
   pelo redirect do `.ts`.

5. **Mobile precisa de Range**: Sem Range requests, o browser nao inicia
   playback de mp4 grandes.

6. **VideoPlayer detecta extensao**: `.m3u8` usa hls.js, qualquer outra usa
   `<video>` nativo.

7. **Frontend e servido pelo backend**: Nao usar Cloudflare Pages para o
   frontend (evita CORS).

8. **Layout split precisa de fixed inset-0**: Usar `min-h-full` em telas
   com split causa problemas — o player some quando o usuario rola.
   Solucao: `fixed inset-0 z-50` trava a viewport e garante que o player
   sempre fique visivel. Coluna de conteudo usa `overflow-y-auto` com
   `min-h-0` para rolar internamente.

9. **Maximizar series mobile nao vai fullscreen nativo**: O botao flutuante
   seta `maximized: true` (mesmo padrao FILMES) mas no iOS/Android so
   rotaciona a tela. O botao nativo do `<video controls>` tambem so
   rotaciona. Funciona no desktop (mostra player em tela cheia via layout
   React). Pendente: usar Fullscreen API do navegador.

---

## Proximos passos (se necessario)

- [x] ~~Retry de stream em caso de falha~~ (implementado: fallback em 401/403)
- [x] ~~Layout split fixo para TV/series~~ (implementado: fixed inset-0 z-50)
- [x] ~~Auto-play primeiro canal~~ (implementado: useEffect + useRef)
- [x] ~~Layout mobile series (poster+player+episodios)~~ (implementado: renderMode)
- [ ] **Fullscreen nativo no mobile** (requestFullscreen API no video — pendente)
- [ ] EPG completo (xmltv parsing)
- [ ] Fallback de catalogo (categories/VOD) — reutilizando reauth.ts + withFallback.ts
- [ ] PWA manifest
- [ ] Download offline (v2)
- [ ] Chromecast/AirPlay (v2)
- [x] ~~Transcodicao on-the-fly (ffmpeg -> HLS H.264/AAC) para HEVC/AC3~~ (implementado: fallback automatico no player via /transcode/...)
- [ ] Limite de processos ffmpeg concorrentes em iptv/transcode.ts (risco de CPU se muitos fallbacks simultaneos)
