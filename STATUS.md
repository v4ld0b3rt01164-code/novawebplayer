# STATUS — NOVA Web Player

Documento vivo do estado atual do projeto. Atualizado em: 2026-07-30
(Randomizacao dos servidores candidatos no login; proxy de imagens do catalogo
resolvendo Mixed Content; logs legiveis silenciando o pino; **forçar hls.js no
Chrome para resolver erro "Formato não suportado" em streams com áudio AC3/EAC3**).
**Nota conhecida**: Maximizar series mobile so rotaciona tela (nao fullscreen nativo).

---

## 1. Visao geral

Cliente web de paineis IPTV Xtream Codes, com backend Node + frontend React.
O usuario final so ve o dominio `https://novawebplayer.app` (mesma origem em
producao, via Cloudflare Tunnel). Os dominios IPTV e as credenciais ficam
isolados no backend.

---

## 2. Stack

| Camada   | Tecnologia |
|----------|------------|
| Backend  | Node.js + Fastify 5 + TypeScript 6 |
| Frontend | React 19 + Vite 8 + TypeScript + TailwindCSS 4 |
| Player   | `<video>` nativo + hls.js (live) |
| Data     | React Query 5 |
| XMLTV    | fast-xml-parser 5 (backend, cache 30 min) |
| Sessao   | Persistida em disco + token UUID (TTL 24h) |
| Favoritos | localStorage (chave `nova-favorites`), singleton compartilhado |
| Operacao | PM2 7 (local), Cloudflare Tunnel (publico), scripts Windows `.bat` |

---

## 3. Endpoints

### Backend (`https://novawebplayer.app`)

| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET    | `/api/health` | nao | healthcheck |
| POST   | `/api/auth` | nao | login com `{ username, password }` (fallback entre 8 dominios; rate limit 5 req/min por IP) |
| GET    | `/api/live/categories` | sim | categorias de TV ao vivo |
| GET    | `/api/live/streams?category_id=` | sim | canais da categoria (category_id opcional — sem ele, retorna todos) |
| GET    | `/api/live/short_epg/:stream_id` | sim | EPG curto |
| GET    | `/api/movies/categories` | sim | categorias de filmes |
| GET    | `/api/movies/streams?category_id=` | sim | filmes (category_id opcional — sem ele, retorna todos) |
| GET    | `/api/movies/:vod_id` | sim | info de um filme |
| GET    | `/api/series/categories` | sim | plataformas |
| GET    | `/api/series?category_id=` | sim | series (category_id opcional — sem ele, retorna todas) |
| GET    | `/api/series/:series_id` | sim | info + temporadas + episodios |
| GET    | `/api/epg` | sim | XMLTV parseado (cache 30 min) |
| GET    | `/api/epg/channel/:epg_channel_id` | sim | EPG de um canal |
| GET    | `/api/img?u=` | nao | proxy de imagens do catalogo (logos/capas) — resolve Mixed Content em HTTPS |
| OPTIONS | `/stream/:type/:file` | sim | CORS preflight |
| GET    | `/stream/:type/:file` | sim | proxy de playlist .m3u8 ou arquivo .mp4/.ts (com Range) |
| GET    | `/stream/seg/:type/:file/:segment` | sim | proxy de segmento .ts (live) |
| GET    | `/transcode/:type/:file` | sim | HLS transcodificado via ffmpeg (H.264/AAC) — fallback do player; responde SEMPRE .m3u8, mesmo com .mp4 no path |
| GET    | `/transcode/seg/:type/:file/:segment` | sim | segmento do HLS transcodificado |

---

## 4. Como funciona o proxy de streams e imagens

### Imagens do catalogo (logos/capas)

Logos de canais, capas de filmes, backdrops de series e imagens de
episodios chegam do painel Xtream como URLs `http://` (ex:
`http://img.hzplay.fun/...`, `http://st1.coverstmdb.xyz:8080/...`). Como o
frontend roda em HTTPS, carregar essas URLs diretamente gera Mixed Content
e o navegador bloqueia.

Solucao: o `catalog.ts` reescreve cada URL de imagem para `/api/img?u=<url
encoded>` (URL relativa -> mesma origem HTTPS). A rota `GET /api/img` no
backend (`routes/img.ts`) busca o binario upstream via http/https e
devolve via HTTPS, com cache de 24h. Sem auth (imagens de catalogo nao
sao sensiveis; ha rate limit global protegendo abuso).

Campos reescritos: `stream_icon` (live + vod), `cover` (vod info + series),
`backdrop_path[]` (series + series info), `movie_image` (episodios).

### Live (HLS)

1. Frontend pede `/stream/live/217275.m3u8?token=xxx`
2. Backend busca m3u8 do upstream (`liderpremium.xyz/live/user/pass/217275.m3u8`)
3. Backend reescreve URLs dos segmentos para `/stream/seg/live/...`
4. Backend armazena IP real do servidor (descoberto via redirect do `.ts`)
5. Frontend (hls.js) pede segmentos ao backend
6. Backend busca segmentos do IP real (Cloudflare bloqueia `/hls/...`)

### VOD/Series (mp4)

1. Frontend pede `/stream/movie/722955.mp4?token=xxx`
2. Backend detecta extensao `.mp4` (nao e m3u8)
3. Backend busca mp4 do upstream com suporte a Range requests
4. Backend retorna stream com headers `Accept-Ranges: bytes`
5. Browser usa `<video>` nativo (sem hls.js)

**NOTA iOS (2026-07-29)**: No iOS Safari, o VideoPlayer detecta automaticamente
a ausencia de MSE (`!Hls.isSupported()`) com suporte a HLS nativo e redireciona
VOD nao-HLS (.mp4/.mkv) direto para `/transcode/...` (ffmpeg H.264/AAC HLS),
evitando completamente a deteccao nao-conflavel de erro de codec no iOS. O
fallback reativo (onerror, webkitAudioDecodedByteCount) continua ativo para
macOS Safari e outros cenarios.

### Descoberta do servidor real

O Cloudflare bloqueia requests GET para `/hls/...` (retorna 403/404).
Solucao: o backend faz request para `/live/user/pass/ID.ts` com
`redirect: 'manual'`, le o header `Location` que aponta para o IP
real (ex: `http://130.250.188.105:80/...`), cacheia esse IP, e usa
para buscar segmentos.

---

## 5. Frontend — fluxos

### Login
1. `POST /api/auth` com `{ username, password }`.
2. Backend embaralha os 8 dominios (Fisher-Yates) e tenta em ordem aleatoria,
   com timeout 5s cada. Cada login comeca por um servidor diferente, distribuindo
   carga e evitando travar sempre no mesmo dominio instavel. Sucesso = `user_info.auth === 1`.
3. Log legivel no console do backend: `[auth] login OK — servidor ativo: <host> (sessão <token>…)`.
4. Token UUID guardado **apenas em memoria** (Context). Nenhum localStorage/sessionStorage.
5. Proximas chamadas enviam `Authorization: Bearer <token>`.
6. Erro 401 com mensagem generica (sem expor credenciais).
7. **Fallback de stream reutiliza o mesmo `authenticate()` embaralhado** —
   `reauthenticateSession()` (reauth.ts) exclui os dominios ja bloqueados da
   sessao e embaralha os restantes, trocando de servidor automaticamente em
   401/403 do upstream.

### Menu
- 3 botoes com SVGs sem moldura (sem bg, ring, shadow, rounded).
- **Desktop**: empilhados, SVG 192px, texto 3xl.
- **Mobile**: 3 colunas lado a lado, SVG 80px, texto base, visiveis todos sem scroll.
- Botao "Sair" limpa o contexto e o cache do React Query.

### Favoritos
- Disponivel como **primeira categoria** dentro de TV AO VIVO, FILMES e SERIES & NOVELAS.
- Botao de coracao (coracao outline/preenchido) em cada card de canal/filme/serie.
- Dados persistidos no `localStorage` (chave `nova-favorites`).
- Cada categoria Favoritos mostra contagem de itens.
- Ao clicar, filtra e mostra apenas itens marcados com coracao.
- **Singleton**: `useFavorites` usa variavel modulo compartilhada (`cached`) + listeners para sincronizar todos os componentes instantaneamente.
- **Backend**: endpoints de streams aceitam `category_id` opcional. Sem category_id, busca todos os streams via Xtream API direto (sem duplicar requests por categoria).
- **Arquivos**: `useFavorites.ts` (hook), `FavoriteButton.tsx` (botao), `FavoritesScreen.tsx` (tela reservada, nao usada no menu), `index.ts` (exports).

### TV AO VIVO
- Categorias -> Canais -> Player.
- **Auto-play**: ao entrar em uma pasta, o primeiro canal e selecionado automaticamente e o player comeca a reproduzir.
- **Layout split fixo (desktop)**: player + EPG travados com `fixed inset-0 z-50`, coluna de canais rola com `overflow-y-auto` separado. Garante que o player sempre fique visivel sem scrollar.
- **Layout split fixo (mobile)**: player + EPG em cima (`flex-shrink-0`), canais embaixo (`overflow-y-auto flex-1`).
- **Maximizar**: botao de setas no canto do player -> tela inteira com EPG. Botao de voltar -> minimiza.
- EPG now/next na lista de canais.
- Player: hls.js (Chrome/Firefox/Edge desktop) ou nativo (Safari macOS
  + iOS). **Sempre hls.js em não-Safari/iOS (2026-07-30)** — antes o
  Chrome usava HLS nativo quando `canPlayType('application/vnd.apple.mpegurl')`
  retornava truthy, o que causava `MEDIA_ERR_SRC_NOT_SUPPORTED` em
  poucos segundos em streams com áudio AC3/EAC3 (comum em IPTV BR,
  ex.: A&E SD). hls.js é tolerante e toca o vídeo mesmo sem decodificar
  o áudio incompatível. **iOS (qualquer browser, não só Safari) é
  sempre roteado para HLS nativo** — todos os browsers iOS são WebKit
  por baixo, e é o que as correções anteriores (iOS WebKit redirect,
  `webkitAudioDecodedByteCount`) assumem.

### FILMES
- Tela inicial: lista de categorias + busca geral.
- Dentro da categoria: filtro local pelo nome.
- **Layout desktop**: info do filme (poster, sinopse, diretor, elenco) na coluna esquerda, mini-player 50% na direita.
- **Layout mobile**: player em cima, info embaixo.
- **Maximizar**: botao de setas -> tela inteira.
- Player: `<video>` nativo (mp4).

### SERIES & NOVELAS
- Tela inicial: lista de plataformas + busca geral.
- Grade de series: filtro local.
- **Ao clicar em uma serie**: detalhe (poster + placeholder player) abre imediatamente.
- Detalhe da serie: temporadas (chips) + busca de episodios.
- **Layout split fixo (desktop)**: detalhe + lista de episodios na coluna esquerda (scroll), mini-player 50% na direita.
- **Layout mobile**: poster+sinopse topo → miniplayer (com botao flutuante maximizar) → temporadas+episodios (scroll).
- **renderMode** no `SeriesDetailContent`: `poster` | `episodes` | `all` (controle de o que renderizar).
- **Maximizar**: botao flutuante seta `maximized: true` -> player em tela cheia com botao minimizar (mesmo padrao FILMES). **Nota: no mobile so rotaciona a tela, nao ativa fullscreen nativo.**
- Player: `<video>` nativo (mp4).

### Player (VideoPlayer.tsx)
- Detecta extensao do arquivo na URL.
- `.m3u8` -> hls.js (Chrome/Firefox) ou nativo (Safari).
- `.mp4`, `.mkv`, `.ts` -> `<video>` nativo direto.
- **iOS WebKit redirect (2026-07-29)**: Se `!Hls.isSupported()` (iOS Safari sem
  MSE) + source nao-HLS com `fallbackSrc` disponivel, o player redireciona
  automaticamente para o transcode (`/transcode/...`) ANTES de tentar o proxy
  direto. Isso resolve o erro "formato nao suportado" no iPhone para VOD com
  codecs incompatíveis (HEVC, AC3, MKV, etc.). macOS Safari (tem MSE) e live
  (.m3u8) nao sao afetados.
- URLs `/transcode/...` -> SEMPRE HLS, independente da extensao no path.
- Auto-unmute apos playback iniciar.
- Retry automatico em caso de erro de rede (ate 5x).
- **Fallback automatico para `/transcode/...`** (prop `fallbackSrc`, 1x por
  sessao de reproducao via `triedFallbackRef`), acionado por:
  - erro do `<video>` code 3 (DECODE) ou 4 (SRC_NOT_SUPPORTED);
  - hls.js MEDIA_ERROR fatal com retries esgotados, ou OTHER_ERROR fatal;
  - **heuristica "toca mudo" (so WebKit/iOS)**: `webkitAudioDecodedByteCount`
    igual a 0 apos 3s de reproducao ativa (desmutado, nao pausado,
    currentTime avancando) — cobre video H.264 + audio AC3/EAC3 que o iOS
    toca sem som e sem disparar erro.
  - Tela de erro so aparece se a fonte direta E o transcode falharem;
    "Tentar novamente" reseta para a fonte direta.
- Media Session API para controles de lock screen.

---

## 6. Seguranca

- Dominios IPTV **so no backend** (`backend/src/iptv/servers.ts`).
- **Ordem dos dominios e randomizada por login** (Fisher-Yates em
  `auth.ts:shuffle`). Cada login comeca por um servidor diferente, sem
  viés; o fallback de stream re-embaralha os restantes (excluindo os ja
  bloqueados da sessao). Nao hi hardcode de "servidor primario".
- Credenciais **nunca** vao para o frontend. So trafegam em `POST /api/auth`.
- Backend associa o servidor ativo ao token UUID em memoria (TTL 24h).
- `localStorage` usado **apenas** para favoritos (IDs de itens, nao dados sensiveis).
- Erros de login nao mencionam senha ou dominio.
- **Logs do backend sao legiveis e isolados**: pino silenciado
  (`logger.level: 'error'`); logs de negocio via `console.log` legiveis
  (`[auth]`, `[stream]`, `[proxy]`, `[fallback]`, `[reauth]`, `[transcode]`)
  vao SO para o console do backend e `backend.log`, jamais para o usuario
  final. URLs upstream com credenciais sao mascaradas (`maskUrl`).
- **Static serving via @fastify/static** (root fixo em `frontend/dist`;
  path traversal com `..` retorna 403). Nenhum caminho de arquivo e
  construido a partir de `req.url`.
- **Rate limiting** (`@fastify/rate-limit`): 300 req/min global +
  5 req/min em `POST /api/auth`, por IP. Estouro responde 429.
- **`trustProxy: true`**: IP real do cliente via `X-Forwarded-For` do
  Cloudflare Tunnel (rate limit por usuario, nao por IP do tunnel).
- **Headers de seguranca** no hook `onSend` (nosniff, DENY, HSTS, etc.) +
  `cache-control: no-store` forcado em respostas `text/html`.
- **Proxy de imagens** (`GET /api/img`): so busca http:// ou https://,
  nao exige auth, protegido pelo rate limit global. Resolve Mixed Content
  sem expor dominios IPTV ao frontend (a URL do painel fica no query
  param `u`, mas o host do backend e a mesma origem do site).
- Detalhes e historico completo: `SECURITY.md`.

---

## 7. Operacao

### Build completo
```powershell
cd frontend; npm run build
cd ..\backend; npm run build
npx pm2 restart nova-backend
```

### Dev local
```powershell
cd backend; npm run dev      # http://localhost:3001
cd frontend; npm run dev     # http://localhost:5173
```

### Producao local (backend serve frontend)
```powershell
cd backend; npm start        # http://localhost:3001 + serve frontend/dist
```

### Scripts Windows
- `start.bat` - Inicia backend + tunnel (sem janelas: `Start-Process -WindowStyle Hidden`)
- `stop.bat` - Para tudo
- `restart.bat` - Para e reinicia (sem janelas)
- `status.bat` - Verifica saude (PM2, porta, build, health)
- `install-startup.bat` - Instala auto-inicializacao via Task Scheduler
- `uninstall-startup.bat` - Remove auto-inicializacao

**Sem janelas abertas (2026-07-30)**: `start.bat` e `restart.bat` agora
usam `powershell Start-Process -WindowStyle Hidden` em vez de
`start /min cmd /c "..."`, entao nenhum `cmd.exe` fica visivel na
taskbar ao iniciar/reiniciar. Processos rodam totalmente ocultos.

### Cloudflare Tunnel
- Binario: `C:\Program Files (x86)\cloudflared\cloudflared.exe`
- Tunnel: `novawebplayer` (UUID `aed0ffcf-...`)
- Config: `C:\Users\Valdo\.cloudflared\config.yml`

### PM2
- Processos: `nova-backend` (porta 3001) + `nova-tunnel` (cloudflared)
- Ecosystem: `backend/ecosystem.windows.config.cjs`
- Logs: `C:\Users\Valdo\.pm2\logs\`

---

## 8. Verificacoes executadas

- Login com fallback entre 8 dominios: OK
- **Randomizacao dos dominios por login (Fisher-Yates): OK — cada login comeca por servidor diferente (validado em producao 2026-07-30, sessao em lidertv.xyz)**
- **Logs legiveis no console do backend (`[auth]` servidor ativo, `[stream]` host por m3u8, `[proxy]` servidor real descoberto): OK — pino silenciado, sem vazamento para o frontend**
- **Proxy de imagens do catalogo (`/api/img?u=...`) resolvendo Mixed Content: OK — logos/capas carregam via HTTPS mesma origem (validado 2026-07-30)**
- **Scripts Windows sem janelas (Start-Process -WindowStyle Hidden): OK**
- **Fallback em tempo real durante streaming (401/403): OK**
- **Single-flight de re-autenticacao (concorrencia): OK**
- TV ao vivo (HLS com proxy de segmentos): OK (desktop + mobile)
- **Auto-play primeiro canal ao entrar na categoria: OK**
- **Layout split fixo TV ao vivo (player + EPG travados, canais rolando): OK (desktop + mobile)**
- Botao maximizar/minimizar live: OK
- Filmes VOD (mp4 com Range requests): OK (desktop + mobile)
- Layout filmes desktop: info esquerda, player direita (50/50): OK
- Botao maximizar/minimizar filmes: OK
- Series (mp4 com Range requests): OK (desktop + mobile)
- **Split series (detalhe + placeholder player ao clicar): OK**
- **Layout mobile series (poster+player+episodios): OK**
- **renderMode (poster/episodes/all): OK**
- Layout split fixo series desktop (detalhe fixo + episodios scrollaveis + player): OK
- Botao maximizar/minimizar series desktop: OK
- **Botao maximizar series mobile: so rotaciona tela (pendente fullscreen nativo)**
- Menu responsivo (sem moldura, 3 colunas mobile): OK
- Busca em filmes e series: OK
- **Favoritos: categoria dentro de Live, Movies e Series — OK**
- **Botao de coracao em todos os cards (Live, Movies, Series) — OK**
- **Persistencia de favoritos no localStorage — OK**
- **Sincronizacao entre componentes via singleton — OK**
- **Backend: endpoints com category_id opcional para favoritos — OK**
- Scripts Windows (start/stop/restart/status): OK
- Auto-inicializacao via Task Scheduler: OK
- **Path traversal (`--path-as-is` e `%2e%2e`): 403 bloqueado (validado em producao)**
- **Home `/`, `/index.html`, SPA fallback (`/live` com F5): 200 com no-store**
- **Assets `/assets/*`: 200 com cache 30d immutable**
- **Rate limit login: 6 tentativas seguidas → 5x 401 + 1x 429**
- **Fallback transcode: tsc -b --noEmit + build OK; validado em iPhone (usuario real) — 2026-07-29**
- **Sessao persistida em disco (sessions.json): OK**
- **VOD iPhone (filmes + series): OK — iOS WebKit redirect para /transcode validado por usuario iPhone**
- **Forçar hls.js no Chrome para AC3/EAC3 (live A&E SD no Chrome parava com
  "Formato não suportado pelo navegador" após poucos segundos; no Firefox
  rodava normal): OK — invertido `isSafari && canPlayType` para
  `!isSafari && Hls.isSupported()` em `VideoPlayer.tsx:106-135`; typecheck +
  build OK 2026-07-30**

---

## 9. Armadilhas conhecidas

1. **BOM UTF-8 em .bat**: Write tool salva com BOM. Reescrever sem BOM.
2. **Caracteres UTF-8 em .bat**: Evitar `=, -`. Usar ASCII.
3. **`call npx`**: Usar `call npx pm2` nos .bat, senao o batch nao espera.
4. **Cloudflare bloqueia /hls/**: Segmentos so funcionam via IP real.
5. **Mobile precisa de Range**: Sem Range requests, browser nao inicia mp4.
6. **VideoPlayer detecta extensao**: `.m3u8` usa hls.js, outra usa nativo.
7. **Frontend servido pelo backend**: Nao usar Cloudflare Pages (evita CORS).
8. **Layout split precisa de fixed inset-0**: Usar `min-h-full` em telas com split causa problemas — o player some quando rola. Solucao: `fixed inset-0 z-50` trava a viewport. Coluna de conteudo usa `overflow-y-auto` com `min-h-0`.
9. **Maximizar series mobile nao vai fullscreen nativo**: Botao flutuante seta `maximized: true` (padrao FILMES) mas no iOS/Android so rotaciona a tela. Pendente: usar Fullscreen API do navegador.

---

## 10. Proximos passos sugeridos

- [x] ~~Retry de stream em caso de falha~~ (implementado: fallback 401/403)
- [x] ~~Layout split fixo para TV/series~~ (implementado: fixed inset-0 z-50)
- [x] ~~Auto-play primeiro canal~~ (implementado: useEffect + useRef)
- [x] ~~Layout mobile series (poster+player+episodios)~~ (implementado: renderMode)
- [x] ~~Favoritos~~ (implementado: categoria dentro de Live, Movies e Series com persistencia localStorage)
- [x] ~~Randomizacao dos servidores por login~~ (implementado: Fisher-Yates em auth.ts 2026-07-30)
- [x] ~~Proxy de imagens do catalogo (Mixed Content)~~ (implementado: /api/img + reescrita em catalog.ts 2026-07-30)
- [x] ~~Logs legiveis no backend~~ (implementado: pino silenciado + logs [auth]/[stream]/[proxy] 2026-07-30)
- [x] ~~Scripts Windows sem janelas abertas~~ (implementado: Start-Process -WindowStyle Hidden 2026-07-30)
- [ ] **Fullscreen nativo no mobile** (requestFullscreen API no video — pendente)
- [ ] EPG completo (xmltv parsing mais robusto)
- [ ] Fallback de catalogo (categories/VOD) — mesma arquitetura de reauth.ts
- [ ] PWA manifest
- [ ] Download offline (v2)
- [ ] Chromecast/AirPlay (v2)
- [ ] Testes automatizados (vitest backend, playwright frontend)
- [ ] Layout responsivo avancado (grid dinamico para telas intermediarias)
- [x] ~~Transcodicao on-the-fly (ffmpeg -> HLS H.264/AAC) para HEVC/AC3~~ (implementado: fallback automatico no player + iOS WebKit redirect)
- [x] ~~VOD iPhone (filmes/series) — iOS WebKit redirect para /transcode~~ (validado por usuario iPhone 2026-07-29)
- [ ] Limite de processos ffmpeg concorrentes (iptv/transcode.ts)

---

## 11. Auditoria de documentacao (2026-07-30)

Em 2026-07-30 foi feita uma varredura completa dos `.md` do projeto
(`STATUS.md`, `AGENTS.md`, `PRD.md`, `DESIGN.md`, `RESTORE_POINT.md`,
`SECURITY.md`, `SCRIPTS.md`, `scripts/windows/README.md`,
`frontend/README.md`) contra o codigo-fonte real. Foram identificadas
**20 inconsistencias** (info errada, info faltando, lixo de encoding,
referencia a codigo morto). Todas foram corrigidas em um unico commit
dedicado. Resumo:

| # | Arquivo | Tipo | Correcao |
|---|---|---|---|
| 1 | `DESIGN.md` §5.5 | info errada | Secao reescrita — backend agora proxia imagens via `/api/img` (nao "nada" como dizia antes) |
| 2 | `scripts/windows/README.md` L75 | nome errado | `pm2 logs nova-web-player` → `pm2 logs nova-backend` |
| 3 | `RESTORE_POINT.md` §header | desatualizado | "ultimo commit" agora reflete os 6 commits do dia |
| 4 | `RESTORE_POINT.md` L43 | pendente → feito | Tabela de checkpoints substituiu "_pendente_" pela tag `checkpoint-2026-07-30` |
| 5 | `PRD.md` L60, L87 | info errada | "lista ordenada" / "ordem definida" → Fisher-Yates aleatorio |
| 6 | `STATUS.md` L146 | lixo encoding | "tela预留" → "tela reservada" |
| 7 | `AGENTS.md` L186 | info errada | "git local sem remote" → menciona `github.com/v4ld0b3rt01164-code/novawebplayer.git` |
| 8 | `AGENTS.md` §Estrutura | incompleto | +16 arquivos reais (backend: categoryOrder, codec, transcode, types, img route, etc; frontend: menu, favorites, types, api) |
| 9 | `AGENTS.md` L44 | codigo morto | `HlsPlayer.tsx` e `Mp4Player.tsx` removidos do projeto (0 importacoes); unificado em `VideoPlayer.tsx` |
| 10 | `AGENTS.md` §Stack L11-13 | ambiguo | Reformulado para alinhar com a logica real do `VideoPlayer.tsx` (hls.js em nao-Safari/iOS) |
| 11 | `AGENTS.md` L19-20 | info errada | "Express ou Fastify" → "Fastify 5" (Express nunca foi usado) |
| 12 | `SCRIPTS.md` §Estrutura | incompleto | Adicionado `periodic-restart.ps1` na lista |
| 13 | `scripts/windows/README.md` L52-58 | incompleto | Explicacao completa de `periodic-restart.ps1` (8h, smart restart do tunnel) |
| 14 | `RESTORE_POINT.md` §Estrutura | incompleto | Adicionada pasta `features/favorites/` na arvore |
| 15 | `STATUS.md` L222 + `SECURITY.md` L293-296 | tag de log faltando | `[transcode]` adicionado a lista (existe em `iptv/transcode.ts:155-187`) |
| 16 | `AGENTS.md` L64 | incompleto | Rotas agora mencionam `/transcode/*` e `/api/img` alem de `/api/*` e `/stream/*` |
| 17 | `frontend/README.md` | template padrao | Substituido por conteudo real do projeto (comandos, estrutura, decisoes) |
| 18 | `PROMPT.md` | — | Mantido como historico (kickoff inicial) |
| 19 | `RESTORE_POINT.md` L308-309 | conta descartavel | Mantido (confirmado pelo autor — conta de teste) |
| 20 | `DESIGN.md` §5.4 | incompleto | Adicionado `favoritos.svg` na lista de SVGs do menu |

Alem disso, foi criada a tag **`checkpoint-2026-07-30`** marcando o
estado estavel apos essas correcoes.
