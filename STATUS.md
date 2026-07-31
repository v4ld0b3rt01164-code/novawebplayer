# STATUS — NOVA Web Player

Documento vivo do estado atual do projeto. Atualizado em: 2026-07-31
(Login aleatorio entre 8 dominios; monitor local de sessoes; restart sem janelas visiveis;
Favoritos: categoria dentro de Live, Movies e Series com persistencia localStorage;
fallback mobile para VOD com formato/codec recusado).
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
| POST   | `/api/auth` | nao | login com `{ username, password }` (ordem aleatoria + fallback entre 8 dominios; rate limit 5 req/min por IP) |
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
| OPTIONS | `/stream/:type/:file` | sim | CORS preflight |
| GET    | `/stream/:type/:file` | sim | proxy de playlist .m3u8 ou arquivo .mp4/.ts (com Range) |
| GET    | `/stream/seg/:type/:file/:segment` | sim | proxy de segmento .ts (live) |
| GET    | `/transcode/:type/:file` | sim | LIVE retorna HLS; MOVIES/SERIES retornam MP4 H.264/AAC com Range |
| GET    | `/transcode/seg/:type/:file/:segment` | sim | segmento HLS transcodificado (LIVE) |

---

## 4. Como funciona o proxy de streams

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
VOD nao-HLS (.mp4/.mkv) direto para `/transcode/...`. O backend entrega esse
fallback como MP4 H.264/AAC progressivo, evitando codec incompatível sem fazer
o Safari tratar o filme como uma transmissao HLS.

**NOTA mobile (2026-07-31)**: Em Android e nos casos em que o navegador rejeita
`video.play()` com `NotSupportedError` sem emitir `error` de forma confiavel, o
VideoPlayer agora aciona o mesmo fallback `/transcode/...`. O listener de erro e
registrado antes da primeira carga. O proxy tambem entrega `video/mp4` para
arquivos `.mp4`/`.m4v`, mesmo quando o painel retorna MIME generico.

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
2. Backend embaralha os 8 dominios com `crypto.randomInt` e tenta a nova ordem, com timeout 5s. Sucesso = `user_info.auth === 1`.
3. Token UUID guardado **apenas em memoria** (Context). Nenhum localStorage/sessionStorage.
4. Proximas chamadas enviam `Authorization: Bearer <token>`.
5. Erro 401 com mensagem generica (sem expor credenciais).
6. Se um stream retornar 401/403, a reautenticacao repete o processo entre os dominios ainda disponiveis.

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
- **Arquivos**: `useFavorites.ts` (hook), `FavoriteButton.tsx` (botao), `FavoritesScreen.tsx` (tela预留, nao usada no menu), `index.ts` (exports).

### TV AO VIVO
- Categorias -> Canais -> Player.
- **Auto-play**: ao entrar em uma pasta, o primeiro canal e selecionado automaticamente e o player comeca a reproduzir.
- **Layout split fixo (desktop)**: player + EPG travados com `fixed inset-0 z-50`, coluna de canais rola com `overflow-y-auto` separado. Garante que o player sempre fique visivel sem scrollar.
- **Layout split fixo (mobile)**: player + EPG em cima (`flex-shrink-0`), canais embaixo (`overflow-y-auto flex-1`).
- **Maximizar**: botao de setas no canto do player -> tela inteira com EPG. Botao de voltar -> minimiza.
- EPG now/next na lista de canais.
- Player: hls.js (Chrome/Firefox) ou nativo (Safari).

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
- `/transcode/live/...` -> HLS; `/transcode/movie/...` e `/transcode/series/...` -> MP4 progressivo.
- Auto-unmute apos playback iniciar.
- Retry automatico em caso de erro de rede (ate 5x).
- **Fallback automatico para `/transcode/...`** (prop `fallbackSrc`, 1x por
  sessao de reproducao via `triedFallbackRef`), acionado por:
  - rejeicao `NotSupportedError` da Promise de `video.play()` (mobile);
  - erro do `<video>` code 3 (DECODE) ou 4 (SRC_NOT_SUPPORTED);
  - hls.js MEDIA_ERROR fatal com retries esgotados, ou OTHER_ERROR fatal;
  - **heuristica "toca mudo" (so WebKit/iOS)**: `webkitAudioDecodedByteCount`
    igual a 0 apos 3s de reproducao ativa (desmutado, nao pausado,
    currentTime avancando) — cobre video H.264 + audio AC3/EAC3 que o iOS
    toca sem som e sem disparar erro.
- Tela de erro so aparece se a fonte direta E o transcode falharem;
  "Tentar novamente" reseta para a fonte direta.
- Media Session API para controles de lock screen.

### Correcao de compatibilidade VOD mobile (2026-07-31)

- Causa identificada: o fallback antigo convertia Filmes/Séries para HLS. O
  Safari apresentava a etiqueta "Transmissao ao Vivo" mesmo sendo VOD.
- Correcao: somente Live usa HLS. Filmes e Séries usam MP4 progressivo
  transcodificado em H.264/AAC, com `yuv420p`, `faststart` e `Range`.
- Android/desktop mantêm a fonte direta como primeira tentativa; o fallback e
  acionado por `NotSupportedError` ou erro de mídia. No WebKit/iPhone, o VOD
  usa o MP4 transcodificado preventivamente porque alguns codecs falham sem
  emitir erro confiavel; nunca e convertido para HLS.
- Arquivos principais: `frontend/src/player/VideoPlayer.tsx`,
  `frontend/src/api/streamUrl.ts`, `backend/src/iptv/transcode.ts` e
  `backend/src/routes/transcode.ts`.
- Artefatos compilados correspondentes ficam em `frontend/dist` e
  `backend/dist`.
- Validacao em dispositivo real: pendente após reinício do backend, cobrindo
  iPhone Safari, iPhone Chrome, Android e um conteúdo VOD que falhava.

---

## 6. Seguranca

- Dominios IPTV **so no backend** (`backend/src/iptv/servers.ts`).
- A ordem dos dominios e embaralhada no backend com `crypto.randomInt`; isso nao expoe a lista ao frontend.
- Credenciais **nunca** vao para o frontend. So trafegam em `POST /api/auth`.
- Backend associa o servidor ativo ao token UUID em memoria (TTL 24h).
- `localStorage` usado **apenas** para favoritos (IDs de itens, nao dados sensiveis).
- Erros de login nao mencionam senha ou dominio.
- **Static serving via @fastify/static** (root fixo em `frontend/dist`;
  path traversal com `..` retorna 403). Nenhum caminho de arquivo e
  construido a partir de `req.url`.
- **Rate limiting** (`@fastify/rate-limit`): 300 req/min global +
  5 req/min em `POST /api/auth`, por IP. Estouro responde 429.
- **`trustProxy: true`**: IP real do cliente via `X-Forwarded-For` do
  Cloudflare Tunnel (rate limit por usuario, nao por IP do tunnel).
- **Headers de seguranca** no hook `onSend` (nosniff, DENY, HSTS, etc.) +
  `cache-control: no-store` forcado em respostas `text/html`.
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
- `start.bat` - Inicia backend + tunnel
- `stop.bat` - Para tudo
- `restart.bat` - Para e reinicia backend + tunnel sem janelas visiveis; grava logs em `backend\*.log`
- `status.bat` - Verifica saude (PM2, porta, build, health)
- `install-startup.bat` - Instala auto-inicializacao via Task Scheduler
- `uninstall-startup.bat` - Remove auto-inicializacao
- `monitor-server.bat` - Mostra localmente o `baseUrl` das sessoes nao expiradas a cada 2 segundos

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
- **Fallback transcode: typecheck/build OK; rejeicao `NotSupportedError`, MIME MP4 e VOD sem HLS cobertos — 2026-07-31**
- **Sessao persistida em disco (sessions.json): OK**
- **VOD mobile (filmes + series): aguardando validacao real em Safari/Chrome iPhone e Android**
- **Login com ordem aleatoria entre 8 dominios: typecheck/build OK; lint OK com aviso preexistente**
- **Monitor local de sessoes (`monitor-server.bat`): OK; nao exibe credenciais ou tokens**
- **`restart.bat` com backend e tunnel ocultos: validado por sintaxe e logs redirecionados**

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
- [ ] **Fullscreen nativo no mobile** (requestFullscreen API no video — pendente)
- [ ] EPG completo (xmltv parsing mais robusto)
- [ ] Fallback de catalogo (categories/VOD) — mesma arquitetura de reauth.ts
- [ ] PWA manifest
- [ ] Download offline (v2)
- [ ] Chromecast/AirPlay (v2)
- [ ] Testes automatizados (vitest backend, playwright frontend)
- [ ] Layout responsivo avancado (grid dinamico para telas intermediarias)
- [x] ~~Transcodificacao de compatibilidade~~ (LIVE -> HLS; MOVIES/SERIES -> MP4 H.264/AAC progressivo)
- [ ] Validar VOD transcodificado em iPhone e Android com conteudo que falha no arquivo direto
- [ ] Limite de processos ffmpeg concorrentes (iptv/transcode.ts)
