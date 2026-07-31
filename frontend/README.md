# Frontend — NOVA Web Player

Cliente web (React 19 + Vite 8 + TypeScript + Tailwind v4) que consome
a API do backend em `https://novawebplayer.app` (mesma origem, via
Cloudflare Tunnel).

Em produção, o backend Fastify serve os arquivos estáticos deste build
(`dist/`) — **não** é preciso um host separado para o frontend.

## Comandos

```bash
npm install        # instala dependências
npm run dev        # Vite dev server em http://localhost:5173 (proxy /api e /stream para http://localhost:3001)
npm run build      # tsc -b + vite build + strip-crossorigin.cjs (gera dist/)
npm run preview    # preview do build de produção
npm run typecheck  # tsc -b --noEmit
npm run lint       # oxlint
```

## Estrutura de pastas

```
src/
  api/           -> client HTTP (client.ts) + construtores de URL de stream (streamUrl.ts)
  player/        -> VideoPlayer.tsx (unificado, HLS + MP4 + fallback /transcode)
  features/      -> auth, favorites, live, movies, series, menu (uma pasta por feature)
  shared/        -> Header, Loading, ErrorState, SectionTitle, Button
  types/         -> tipos TypeScript (espelham backend)
  assets/        -> SVGs/fontes processados pelo Vite
  App.tsx        -> state machine simples: menu | live | movies | series
  main.tsx       -> bootstrap React + React Query
  index.css      -> @theme do Tailwind v4 + utilities pt-safe/pb-safe/...
public/          -> favicon.svg + SVGs do menu (tv-ao-vivo, filmes, series-novelas, favoritos)
scripts/         -> strip-crossorigin.cjs (pós-build, remove crossorigin do index.html)
```

## Decisões de arquitetura

- **Player único** (`VideoPlayer.tsx`): seleciona o pipeline HLS por
  plataforma. `hls.js` em Chrome/Firefox/Edge desktop; HLS nativo em
  Safari (macOS) e iOS (qualquer browser, todos WebKit por baixo). VOD/séries
  mp4 usam `<video>` nativo em todas as plataformas. Implementação e
  detalhes em `frontend/src/player/VideoPlayer.tsx:106-135`.

- **Layout split fixo** (telas com player + lista): `fixed inset-0 z-50`
  para travar a viewport; a coluna de canais/episódios usa
  `overflow-y-auto` com `min-h-0` para rolar internamente. `min-h-full`
  nessas telas faz o player sumir ao rolar — armadilha conhecida, ver
  `AGENTS.md §"O que NÃO fazer"`.

- **Favoritos como categoria** dentro de Live, Movies e Series (não
  como tela separada). `useFavorites` usa variável de módulo
  compartilhada para sincronizar todos os componentes instantaneamente;
  persiste no `localStorage` (chave `nova-favorites`).

- **Design tokens** (cores, safe-areas): ver `DESIGN.md` para a
  especificação visual completa.

## Mais informações

- `DESIGN.md` (raiz) — identidade visual, layout, EPG, thumbs
- `STATUS.md` (raiz) — estado atual do projeto, o que funciona, pendências
- `RESTORE_POINT.md` (raiz) — como restaurar o projeto a um checkpoint
- `AGENTS.md` (raiz) — convenções obrigatórias para agentes de codificação
