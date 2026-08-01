# AGENTS.md — Web IPTV Player

Este arquivo orienta qualquer agente de codificação (Claude Code, etc.)
trabalhando neste repositório. Leia também `PRD.md` antes de qualquer
implementação — ele é a fonte de verdade de requisitos.

## Stack recomendada

- **Frontend**: React + Vite + TypeScript.
- **Estilo**: TailwindCSS (utilitário, fácil de manter responsivo/iOS-safe).
- **Player**: componente unificado `VideoPlayer.tsx` que seleciona o pipeline
  HLS por plataforma — `hls.js` em Chrome/Firefox/Edge desktop, HLS nativo
  em Safari (macOS) e iOS (qualquer browser, todos WebKit por baixo). VOD/séries
  (mp4) usam `<video>` nativo em todas as plataformas. Implementado em
  `frontend/src/player/VideoPlayer.tsx:106-135` (invertido em 2026-07-30 para
  resolver erro `MEDIA_ERR_SRC_NOT_SUPPORTED` em streams com áudio AC3/EAC3
  no Chrome).
- **Estado/dados remotos**: React Query (cache, retry, stale-while-revalidate).
- **Parsing XMLTV**: parser XML leve no backend (ex.: `fast-xml-parser`),
  já que o backend é quem busca o `xmltv.php` de qualquer forma — evita
  mandar o XML bruto (potencialmente grande) para o navegador.
- **Backend**: Node.js + **Fastify 5** + TypeScript 6, rodando na máquina
  local do autor, exposto publicamente via **Cloudflare Tunnel** no domínio
  **novawebplayer.app**. Responsabilidades do backend:
  - Autenticação com fallback entre os 8 domínios IPTV (ver PRD seção 3
    e 5);
  - Proxy/gateway para catálogo (live/VOD/séries) e EPG;
  - Proxy dos streams de vídeo (recomendado, ver PRD seção 10), servindo
    tudo via HTTPS para o frontend.
- **Deploy**: **não usar Cloudflare Pages para o frontend** neste projeto —
  como o backend já roda local via túnel, o mais simples é o próprio
  backend servir os arquivos estáticos do build do frontend (uma única
  origem, `novawebplayer.app`, sem CORS entre front e back). Se
  posteriormente o time decidir separar (frontend em Pages, backend no
  túnel), isso exige configurar CORS explicitamente no backend — anotar
  essa mudança aqui se acontecer.

Se o agente decidir usar stack diferente, deve justificar no PR/commit e
atualizar este arquivo.

## Estrutura de pastas

```
/frontend
  /src
    /api          -> client HTTP (client.ts) + streamUrl.ts (constrói URLs
                      /stream/... e /transcode/... com token)
    /player       -> VideoPlayer.tsx (unificado HLS + MP4, fallback /transcode)
    /features
      /auth       -> LoginScreen, AuthProvider, AuthContext, useAuth
      /favorites  -> useFavorites, FavoriteButton, FavoritesScreen, index.ts
      /live       -> LiveScreen (auto-play + fixed split) + epg.ts (helpers)
      /movies     -> MoviesScreen (categorias + grid + player)
      /series     -> SeriesScreen (renderMode poster/episodes/all + fixed split)
      /menu       -> MenuScreen (3 botões SVG sem moldura)
    /shared       -> Header, Loading, ErrorState, SectionTitle, Button
    /types        -> index.ts (espelha backend) + errors.ts
    /assets       -> SVGs/fontes processados pelo Vite
  /public         -> favicon.svg + tv-ao-vivo.svg + filmes.svg
                     + series-novelas.svg + favoritos.svg
  /scripts        -> strip-crossorigin.cjs (pós-build)

/backend
  /src
    index.ts          -> Fastify bootstrap + @fastify/static + rate limit
                         + trustProxy + headers de segurança + imgRoutes
    /iptv
      servers.ts          -> lista dos 8 domínios candidatos (única fonte)
      auth.ts             -> fallback + autenticação Xtream + shuffle Fisher-Yates
      catalog.ts          -> proxy de live/vod/series (categorias, streams)
                              + reescrita de URLs de imagem -> /api/img
      categoryOrder.ts    -> ordenação/priorização de categorias
      codec.ts            -> detecção de codec do stream
      epg.ts              -> busca e parse do xmltv.php, cache 30 min em memória
      proxy.ts            -> proxy dos streams (live/vod/series) + UpstreamHttpError
                              + descoberta de IP real via redirect do .ts
      reauth.ts           -> re-autenticação com single-flight (dedup por sessão)
      withFallback.ts     -> wrapper de fallback (401/403) para rotas de stream
      transcode.ts        -> pipeline ffmpeg HLS H.264/AAC (fallback de codec)
      types.ts            -> tipagem Xtream Codes (XtreamAuthResponse, etc.)
    /routes
      auth.ts             -> POST /api/auth
      health.ts           -> GET /api/health
      live.ts             -> /api/live/* (categorias, streams, short_epg)
      movies.ts           -> /api/movies/* (categorias, streams, info)
      series.ts           -> /api/series/* (categorias, info + temporadas)
      epg.ts              -> /api/epg/* (XMLTV parseado, canal específico)
      img.ts              -> GET /api/img?u=... (proxy de imagens do catálogo)
      stream.ts           -> /stream/:type/:file + /stream/seg/... (com fallback)
      transcode.ts        -> /transcode/:type/:file + /transcode/seg/...
      streamAuth.ts       -> auth via header Authorization OU ?token=...
      middleware.ts       -> requireAuth (preHandler compartilhado)
    /session
      store.ts            -> sessões em memória + blockedServers Set +
                              updateSessionServer; persistido em
                              backend/sessions.json (debounced write 1s)
    /shared
      errors.ts           -> ApiError e variantes tipadas
    /types
      fastify.d.ts        -> augmentations de tipo para o Fastify
  /public             -> favicon, SVGs do menu, index.html de referência
                         (NÃO é o que o backend serve em produção — esse
                         vem de /frontend/dist)
  /scripts            -> healthcheck.js (chamado por `npm run healthcheck`)
  /sessions.json      -> base de sessões persistida em disco
  /dist               -> build do backend (`tsc` -> dist/index.js)
  ecosystem.config.cjs            -> PM2 (Linux/macOS)
  ecosystem.windows.config.cjs    -> PM2 (Windows — usado em produção)
  nova-web-player.service          -> exemplo de unidade systemd
```

## Regras de implementação (obrigatórias)

1. **O frontend nunca fala diretamente com os domínios IPTV.** Toda
   chamada — auth, catálogo, EPG e (recomendado) streams — vai para o
   próprio backend (`https://novawebplayer.app/api/...` e `/stream/...`).
   Isso é o que resolve mixed content e CORS no iOS; não contornar isso
   fazendo o frontend chamar `liderpremium.xyz` etc. em nenhuma hipótese.
2. **Domínios candidatos ficam em um único arquivo de configuração no
   backend** (`/backend/src/iptv/servers.ts`), nunca espalhados pelo
   código nem expostos ao frontend.
3. **Live sempre `.m3u8`**, nunca `.ts` bruto, na composição da URL de
   stream (ver PRD seção 9). Se precisar suportar `.ts` no futuro, isolar
   essa lógica claramente e documentar o motivo.
4. **`<video>` sempre com `playsInline` e `muted` quando houver autoplay.**
   Testar mentalmente (ou via comentário) o comportamento em iOS Safari
   antes de dar como concluída qualquer feature de player.
5. **Credenciais**: nunca logar usuário/senha no console, nunca incluir em
   mensagens de erro exibidas ao usuário, nunca commitar exemplos reais em
   testes/fixtures (usar valores fake tipo `demo_user` / `demo_pass`).
6. **Categorias e agrupamentos vêm sempre da API**, nunca fixos em código
   (não hardcode listas de categorias como "ABERTOS", "ESPORTES" etc. — são
   exemplos do painel, não uma lista fechada).
7. **Tratamento de erro de rede é obrigatório** em toda chamada de API —
   este projeto depende de servidores de terceiros instáveis por natureza
   (daí o fallback). Nenhuma tela deve travar em branco se uma chamada
   falhar; sempre exibir estado de erro/retry.
8. **Não introduzir dependências pesadas sem necessidade.** Antes de
   adicionar uma lib nova, verificar se dá para resolver com o que já está
   no projeto.
9. **Fallback de stream é automático.** Se o upstream retornar 401/403 em
   qualquer chamada de stream (.m3u8, .ts, .mp4), o backend re-autentica
   nos domínios restantes e repete a chamada. Nunca desabilitar ou ignorar
   esse mecanismo. Usar `UpstreamHttpError` (não `Error` genérico) para
   erros HTTP do upstream que permitem fallback.
10. **Favoritos usam singleton compartilhado.** O hook `useFavorites` mantém
    uma variável de módulo (`cached`) sincronizada via listeners. Ao alterar,
    todos os componentes que usam o hook atualizam instantaneamente. Dados
    persistidos no `localStorage` (chave `nova-favorites`). Nunca criar
    múltiplas instâncias isoladas — usar sempre o hook.
11. **Endpoints de streams aceitam category_id opcional.** Quando omitido,
    retornam todos os itens (Live, Movies, Series). Usado pela tela de
    Favoritos para buscar todas as streams e filtrar pelas salvas no
    localStorage.

## Fluxo de trabalho esperado do agente

1. Ler `PRD.md` (requisitos) e este `AGENTS.md` (convenções) antes de
   codar.
2. Implementar por fatias verticais e testáveis (ex.: "login + fallback"
   antes de "EPG completo").
3. Após cada fatia, rodar build/lint/typecheck antes de seguir para a
   próxima.
4. Não usar dados reais de produção (usuário/senha reais) em commits,
   testes automatizados ou exemplos no código — usar mocks.
5. Ao terminar uma feature, atualizar/checar se o comportamento em iOS
   (Safari) foi considerado explicitamente na implementação do player.

## Comandos (preencher conforme o projeto for criado)

```bash
# Backend (Node + Fastify)
cd backend
npm install
npm run dev        # tsx watch em http://localhost:3001
npm run build      # compila ./src -> ./dist
npm start          # executa dist/index.js
npm run lint
npm run typecheck

# Frontend (Vite + React + TS + Tailwind)
cd frontend
npm install
npm run dev        # Vite em http://localhost:5173 com proxy /api e /stream
npm run build      # gera ./dist
npm run preview    # preview do build de produção
npm run lint
npm run typecheck

# Deploy: em produção, `./backend/dist/index.js` serve os arquivos estáticos
# de `./frontend/dist` na mesma origem https://novawebplayer.app.
```

## Operação / deploy local (máquina do autor)

O backend foi projetado para rodar localmente e ser exposto via
**Cloudflare Tunnel**. Arquivos de operação incluídos:

- `backend/ecosystem.config.cjs` — configuração PM2 (Linux/macOS).
- `backend/nova-web-player.service` — exemplo de serviço systemd.
- `backend/ecosystem.windows.config.cjs` — configuração PM2 para Windows.
- `scripts/windows/` — batchs para iniciar/parar/reiniciar backend + túnel e
  instalar/desinstalar a inicialização automática no logon do Windows.

### Windows — startup automático

Pré-requisitos: `pm2` e `cloudflared` instalados, backend e frontend buildados.

1. Edite `scripts/windows/config.bat` e defina `TUNNEL_NAME`.
2. Rode uma vez: `scripts/windows/install-startup.bat`
3. Controle manual: `start.bat`, `stop.bat`, `restart.bat`.

O `install-startup.bat` cria 3 tarefas no Task Scheduler:
- **NOVA Start**: inicia backend+tunnel no logon do Windows.
- **NOVA Watchdog**: verifica saúde a cada 2 minutos (`watchdog.ps1`).
- **NOVA Periodic Restart**: reinicia o tunnel a cada 8 horas
  (`periodic-restart.ps1`) para evitar estados inconsistentes. Se o backend
  estiver healthy, reinicia apenas o tunnel (sessões em memória preservadas).
  Se unhealthy, reinicia tudo (sessões sobrevivem em disco via
  `backend/sessions.json`). Esse reset é preventivo — não substitui o
  watchdog, que continua detectando quedas imediatas.

Veja `scripts/windows/README.md` para detalhes.

### Checkpoints (git)

O repositório tem remote em `https://github.com/v4ld0b3rt01164-code/novawebplayer.git`
(branch `main`). Estados estáveis validados recebem tag `checkpoint-AAAA-MM-DD`
— os builds (`dist/`) são commitados de propósito para restauração imediata
(ao restaurar, só `npm install` + `pm2 restart`, sem rebuild obrigatório).
Instruções completas de restauração e de criação de novos checkpoints:
`RESTORE_POINT.md`. Agentes NÃO devem criar commits/tags sem pedido explícito
do usuário (regra padrão), mas devem atualizar `STATUS.md`, `SECURITY.md` e
`RESTORE_POINT.md` ao concluir mudanças relevantes.

## O que NÃO fazer

- Não embutir domínio/servidor fixo em nenhum ponto fora do módulo central
  de API.
- Não assumir que todos os 8 domínios de fallback têm exatamente o mesmo
  catálogo — tratar cada login como "servidor ativo único" após o
  fallback, sem misturar dados de domínios diferentes na mesma sessão.
- Não usar `.ts` bruto como source de vídeo para live.
- Não usar `localStorage`/`sessionStorage` para nada além de preferências
  não-sensíveis, a menos que o PRD seja atualizado para permitir
  "lembrar-me" de forma explícita.
- **Não usar `min-h-full` em telas com split layout** (player + lista).
  Usar `fixed inset-0 z-50` para travar a viewport e garantir que o
  player sempre fique visivel. A coluna de conteudo usa `overflow-y-auto`
  com `min-h-0` para rolar internamente.
- **Fullscreen nativo no mobile ainda nao funciona**: O botao flutuante
  de maximizar series usa `maximized: true` (padrao React, mesmo do
  FILMES) mas no iOS/Android so rotaciona a tela. Pendente: implementar
  Fullscreen API do navegador (`requestFullscreen()`).
