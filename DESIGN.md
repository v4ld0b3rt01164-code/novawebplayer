# DESIGN.md — NOVA Web Player

Documento vivo descrevendo o layout, a identidade visual, a tipografia, as
espécies de "thumb" (logos de canal, posters de filme/série) e o
tratamento do EPG no frontend.

Use este documento como referência para reproduzir o visual em outro
projeto ou reescrevê-lo do zero.

---

## 1. Identidade visual

### 1.1 Tema (Tailwind v4)

Cores e tokens são definidos em `frontend/src/index.css` dentro de um bloco
`@theme` — este é o mecanismo nativo do Tailwind v4 para expor design
tokens como utilitários.

```css
@import "tailwindcss";

@theme {
  --color-bg: #0b0b10;          /* fundo principal da app */
  --color-surface: #15151f;     /* cartões, inputs, blocos de conteúdo */
  --color-surface-2: #1d1d2a;   /* lugar-tenistas, chips inativos, etc. */
  --color-accent: #7c3aed;      /* roxo: foco, botões primários, destaques */
  --color-accent-hover: #8b5cf6;
}
```

A partir daí o Tailwind gera as classes utilitárias correspondentes:
`bg-bg`, `bg-surface`, `bg-surface-2`, `bg-accent`, `text-accent`,
`ring-accent`, `shadow-accent/20`, etc.

Texto padrão é a escala `zinc` do Tailwind:

| Uso                  | Classe         |
|----------------------|----------------|
| Texto principal      | `text-zinc-100`|
| Texto secundário     | `text-zinc-400`|
| Texto terciário      | `text-zinc-500`|
| Erros               | `text-red-300` (com `bg-red-950/50` e `ring-red-900`) |
| Destaque de status  | `text-accent`  |

### 1.2 Tipografia

- **Fonte**: stack do sistema, sem webfont.
  - `font-sans` (padrão do Tailwind) resolve para `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
  - Não há nenhuma `@font-face` declarada — o app usa a fonte do dispositivo.
- **Hierarquia típica**:
  - `text-3xl font-bold tracking-tight` — título da tela de login ("NOVA Web Player").
  - `text-2xl font-bold tracking-tight` — título do menu ("O que deseja assistir?").
  - `text-xl font-semibold` — nome de filme/série na página de detalhe.
  - `text-lg font-semibold tracking-wide md:text-3xl` — rótulo dos botões do menu (mobile: `text-base`, desktop: `text-3xl`).
  - `text-sm font-medium` — nome de canal na lista.
  - `text-xs` — metadados (horário do EPG, "A seguir: …", gênero).
  - `text-xs uppercase tracking-wide text-zinc-500` — section title ("Mini guia").

### 1.3 Forma, raio e elevação

- **Raio**: `rounded-xl` (12 px) é o padrão para quase tudo (cartões,
  botões, inputs, chips). `rounded-full` para a bolinha de "voltar" e para os chips de
  temporada. `rounded-lg` em poucos casos (mensagem de erro).
- **Anel (ring)**: `ring-1 ring-zinc-800` é usado em todos os cartões
  para criar uma borda discreta sobre o fundo. `ring-2 ring-accent` no
  estado de foco dos inputs.
- **Sombra**: `shadow-lg shadow-accent/20` no botão primário de login (glow roxo).
  Botões do menu **não têm sombra, bg, ring nem rounded** (SVGs soltos).
  Demais cartões usam apenas ring.
- **Estados de toque**: `active:scale-[0.98]` em todos os itens
  clicáveis. `active:scale-95` no botão "voltar" do header.

### 1.4 Ícones

- **Setas/listas**: inline SVG com `viewBox="0 0 24 24"`, `stroke="currentColor"`,
  `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
  - Chevron de "ir para": `<path d="M9 18l6-6-6-6" />`
  - Chevron de "voltar" no header: `<path d="M15 18l-6-6 6-6" />`
- **Ícones de menu**: três SVGs próprios em `frontend/public/`:
  - `tv-ao-vivo.svg` (viewBox 0 0 300 300, gradiente vermelho)
  - `filmes.svg` (viewBox 0 0 300 300, gradiente azul)
  - `series-novelas.svg` (viewBox 0 0 300 300, gradiente roxo)
  - Todos têm `role="img"` e `aria-label` apropriado.
- **Favicon**: `public/favicon.svg`.

---

## 2. Layout raiz

Em `App.tsx`, cada tela vive dentro de um wrapper que define o canvas:

```tsx
<div className="min-h-full bg-bg text-zinc-100">
  <Screen />
</div>
```

Exceção: a tela de **Séries** usa `h-full overflow-hidden` (em vez de `min-h-full`) quando o player está ativo, para que o container fique fixo na viewport e apenas a lista de episódios tenha scroll interno.

`index.css` força `html, body, #root` a terem `height: 100%`, e o body
aplica `bg-bg text-zinc-100 antialiased` e `-webkit-tap-highlight-color:
transparent` (remove o highlight azul de toque no iOS).

Safe areas do iOS são tratadas por quatro utilities definidas em
`index.css`:

```css
@utility pt-safe { padding-top: env(safe-area-inset-top); }
@utility pb-safe { padding-bottom: env(safe-area-inset-bottom); }
@utility pl-safe { padding-left: env(safe-area-inset-left); }
@utility pr-safe { padding-right: env(safe-area-inset-right); }
```

`index.html` ativa o viewport com `viewport-fit=cover` para que essas
insets existam em iPhones com notch e home indicator.

---

## 3. Header (sticky)

Componente: `frontend/src/shared/Header.tsx`. Usado em todas as telas
que têm drill-down (lista de categorias, lista de canais, lista de
séries, página de detalhe, etc.).

```tsx
<header className="sticky top-0 z-10 flex items-center gap-3 bg-bg/95 px-4 py-3 pt-safe backdrop-blur">
  {onBack && <button ... className="... rounded-full bg-surface ring-1 ring-zinc-800 active:scale-95"><svg>chevron</svg></button>}
  <div>
    <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
    {subtitle && <p className="truncate text-xs text-zinc-400">{subtitle}</p>}
  </div>
</header>
```

Decisões importantes:
- `sticky top-0` com `bg-bg/95` (fundo translúcido) + `backdrop-blur` para
  dar o efeito de "flutuar" sobre o conteúdo ao rolar.
- `pt-safe` para afastar do notch.
- O botão "voltar" só aparece se `onBack` for passada; é um círculo de
  10×10 (h-10 w-10) com o chevron SVG.
- `truncate` no título e no subtítulo para evitar overflow horizontal em
  nomes longos.

---

## 4. Telas

### 4.1 Login (`features/auth/LoginScreen.tsx`)

```
   NOVA
 Web Player          ←  h1, text-3xl, "NOVA" branco + "Web Player" text-accent
Entre com seu usuário e senha do painel.   ←  text-sm zinc-400

[ Usuário                ]              ←  input rounded-xl bg-surface ring-zinc-800
[ Senha                  ]              ←  mesma estética, type=password
[ Entrar                 ]              ←  botão roxo bg-accent shadow-accent/20
[ mensagem de erro em vermelho           ←  aparece se mutation.isError
```

- Container centralizado vertical e horizontalmente.
- `max-w-sm` para o formulário (não esticar demais em desktop).
- Inputs: `rounded-xl bg-surface px-4 py-3.5 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent`.
- Botão primário: `w-full rounded-xl bg-accent py-3.5 font-semibold text-white shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-60`.
- Erro: `rounded-lg bg-red-950/50 p-3 text-sm text-red-300 ring-1 ring-red-900`.

### 4.2 Menu principal (`features/menu/MenuScreen.tsx`)

```
          O que deseja assistir?
       Escolha uma categoria abaixo.

       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │  [SVG]   │ │  [SVG]   │ │  [SVG]   │
       │   📺     │ │   🎬     │ │   🎞️     │
       │ TV AO    │ │ FILMES   │ │ SÉRIES & │
       │  VIVO    │ │          │ │ NOVELAS  │
       └──────────┘ └──────────┘ └──────────┘
         3 colunas lado a lado (mobile, todos visiveis sem scroll)
         empilhados (desktop, SVGs 192px, texto 3xl)
```

- Os três botões usam os SVGs de `public/`, **sem moldura** (sem bg, ring, shadow, rounded).
- **Mobile** (`grid-cols-3`): três colunas lado a lado, SVG 80px, texto `text-base`, gap e padding reduzidos — todos visiveis sem scroll.
- **Desktop** (`grid-cols-1 md:grid-cols-3`): empilhados verticalmente, SVG 192px, texto `text-3xl`.
- Canto superior direito da tela de menu: botão "Sair" — apenas quando há token, limpa o contexto e o cache do React Query.

### 4.3 TV AO VIVO (`features/live/LiveScreen.tsx`)

**Header**: "TV AO VIVO" (com seta "voltar" para o menu).

**Auto-play**: ao entrar em uma pasta de categorias, o primeiro canal e
selecionado automaticamente e o player comeca a reproduzir.

**Layout desktop (quando canal selecionado — fixed split)**:
```
┌─────────────────────────────────────────────────────────┐
│ [< Header: nome do canal                               ]
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│    Lista de canais       │     PLAYER 16:9 (50%)       │
│    (overflow-y-auto)     │     + EPG abaixo            │
│    flex-1 min-h-0        │     + botao maximizar ↗     │
│                          │     (flex-shrink-0)         │
└──────────────────────────┴──────────────────────────────┘
```
- **Container**: `fixed inset-0 z-50` — trava a viewport, player sempre visivel.
- **Esquerda**: lista de canais da categoria (`overflow-y-auto flex-1 min-h-0`).
- **Direita**: player `aspect-video w-full bg-black` (50% da largura) + info EPG + mini guia abaixo.
- **Maximizar**: botao de setas no canto do player -> tela inteira com EPG.

**Layout mobile** (fixed split): player em cima (`flex-shrink-0`), canais embaixo (`overflow-y-auto flex-1`).

**Lista de categorias**:
```
┌─────────────────────────────────────┐
│ ABERTOS                          ›  │
├─────────────────────────────────────┤
│ ESPORTES                         ›  │
├─────────────────────────────────────┤
│ ...
└─────────────────────────────────────┘
```
- Botão de linha: `rounded-xl bg-surface p-4 ring-1 ring-zinc-800 active:scale-[0.98]`.
- Chevron `>` à direita (inline SVG).

**Lista de canais** (dentro de uma categoria):
```
┌────┬──────────────────────────────┐
│logo│ Globo SP                    │
│12×12│ 21:30 Jornal Nacional      │
│12  │ A seguir: 22:00 Novela      │
└────┴──────────────────────────────┘
```
- Card horizontal: `flex min-h-[72px] items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-zinc-800 active:scale-[0.98]`.
- **Logo do canal** (thumb): `h-12 w-12 rounded-lg bg-surface-2 object-contain`.
  - Se a imagem falhar (`onError`), o `<img>` é escondido (`style.display = 'none'`) — o card não quebra, apenas fica sem thumb.
  - `loading="lazy"` para listas grandes.
- **Agora**: `text-xs text-zinc-400` com horário + título do programa (vem do EPG).
- **A seguir**: `text-xs text-zinc-500` com "A seguir: <título>".

**Tela de reprodução** (ao clicar num canal — layout desktop — fixed split):
```
┌─────────────────────────────────────────────────────────┐
│ [< Header: nome do canal                               ]
├──────────────────────────┬──────────────────────────────┤
│ Lista de canais (scroll) │  PLAYER 16:9 (50%)          │
│ flex-1 min-h-0           │  AO VIVO • 21:30 - 22:00    │
│                          │  Título do programa          │
│                          │  MINI GUIA                   │
│                          │  ┌────────────────────────┐  │
│                          │  │ 21:30  Jornal Nacional │  │
│                          │  │ 22:00  Novela          │  │
│                          │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘
```
- **Container**: `fixed inset-0 z-50` — trava a viewport, player sempre visivel.
- Player: `aspect-video w-full bg-black` (50% da largura no desktop).
- Botao maximizar ↗ no canto do player -> tela inteira.
- "AO VIVO • HH:MM - HH:MM" em `text-sm text-accent`.
- Título do programa: `text-lg font-semibold`.
- Descrição: `text-sm leading-relaxed text-zinc-400`.
- "Mini guia": `<SectionTitle>Mini guia</SectionTitle>`, depois até 8 itens.

### 4.4 FILMES (`features/movies/MoviesScreen.tsx`)

**Header**: "FILMES".

**Busca geral (no topo)**:
```
[ Buscar em todos os filmes…              ]
```
- `border-b border-zinc-800 p-4` para criar uma régua que divide a busca do conteúdo.
- Input: mesma estética dos inputs de login, com `placeholder-zinc-500` e `focus:ring-2 focus:ring-accent`.
- Quando o termo tem 2+ letras, faz a busca global (`/api/movies/streams` sem `category_id`) e filtra client-side, exibindo até 200 resultados.

**Lista de categorias** (quando a busca tem < 2 letras):
- Mesma estética da lista de categorias de TV ao vivo (linhas com chevron).

**Grade de filmes** (categoria ou busca geral):
```
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│      │  │      │  │      │  │      │
│ 2:3  │  │ 2:3  │  │ 2:3  │  │ 2:3  │
│      │  │      │  │      │  │      │
│Poster│  │Poster│  │Poster│  │Poster│
└──────┘  └──────┘  └──────┘  └──────┘
Nome        Nome        Nome        Nome
```
- `grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4` — 2 colunas no celular, 3 em tablet, 4 em desktop.
- **Poster (thumb)**: `aspect-[2/3] overflow-hidden rounded-xl bg-surface ring-1 ring-zinc-800` com `object-cover`.
  - Em falha (`onError`), o `<img>` é escondido.
  - `loading="lazy"`.
- **Título**: `mt-2 line-clamp-2 text-sm font-medium leading-tight` — corta em 2 linhas com ellipsis.

**Tela de reprodução** (ao selecionar um filme — layout desktop):
```
┌─────────────────────────────────────────────────────────┐
│ [< Header: nome do filme                               ]
├──────────────────────────┬──────────────────────────────┤
│ Info do filme (scroll)   │  PLAYER 16:9 (50%)          │
│ poster + sinopse +       │  + botao maximizar ↗        │
│ diretor + elenco         │                              │
└──────────────────────────┴──────────────────────────────┘`
- **Esquerda**: poster, titulo, genero/ano, sinopse, diretor, elenco (scrollavel).
- **Direita**: player `aspect-video w-full bg-black` (50%) + botao maximizar.
- **Maximizar**: tela inteira. **Minimizar**: volta ao split.
- **Layout mobile**: player em cima, info embaixo.

### 4.5 SÉRIES & NOVELAS (`features/series/SeriesScreen.tsx`)

Estrutura em 4 níveis de navegação via state machine (`view`):

1. **Categorias (plataformas)**: igual à lista de categorias de filmes (linhas com chevron).
2. **Grade de séries dentro da plataforma**: igual à grade de filmes.
3. **Detalhe da série** (ao clicar — abre split imediatamente com placeholder):
   ```
   [< Header: nome da série            ]
   [                                    ]
   [ poster 28×40   • Lançamento • Gênero ]
   [              • Nome                  ]
   [              • Sinopse (line-clamp-4)]
   [                                    ]
   [ [T1] [T2] [T3] ... ← chips de temp. ]
   [                                    ]
   [ [ Buscar episódios…                ] ]
   [ [ 01  Episódio 1                   ] ]
   [      Sinopse                       ]
   [ [ 02  Episódio 2                   ] ]
   ```
   - Cabeçalho: capa `h-40 w-28 rounded-xl bg-surface object-cover ring-1 ring-zinc-800` + metadados (`text-sm text-accent` para data/gênero, `text-xl font-semibold` para o nome, `line-clamp-4` para a sinopse).
   - Chips de temporada: container `flex gap-2 overflow-x-auto pb-2`. Cada chip: `shrink-0 rounded-full px-4 py-2 text-sm font-semibold`; ativo `bg-accent text-white`; inativo `bg-surface text-zinc-300 ring-1 ring-zinc-800`.
   - Busca local de episódios (mesma estética do input).
   - Lista de episódios: `rounded-xl bg-surface p-3 ring-1 ring-zinc-800 active:scale-[0.98]`, com número `h-12 w-12 rounded-lg bg-surface-2 text-sm font-bold text-zinc-500` + título + sinopse.
4. **Player do episódio** (layout desktop — fixed split):
```
┌─────────────────────────────────────────────────────────┐
│ [< Header: nome da série                               ]
├──────────────────────────┬──────────────────────────────┤
│ [poster + info] (FIXO)   │  PLAYER 16:9 (50%)          │
│ [chips de temporadas]    │  + botao maximizar ↗        │
│ [busca de episódios]     │  + "Assistindo agora"       │
│ [lista de episódios]     │                              │
│ (SOMENTE ESTA PARTE      │                              │
│  ROLA COM SCROLL)        │                              │
└──────────────────────────┴──────────────────────────────┘
```
   - **Container**: `fixed inset-0 z-50` — trava a viewport, player sempre visivel.
   - **Esquerda**: topo fixo (poster, sinopse, chips de temporada, busca) + episodios scrollaveis (`overflow-y-auto`).
   - **Direita**: player `aspect-video` (50%) + card "Assistindo agora" (titulo + numero do episodio).
   - **Maximizar**: tela inteira com botao minimizar (mesmo padrao FILMES).
5. **Layout mobile** (vertical stack):
```
┌─────────────────────────┐
│ THUMB + SINOPSE (fixo)  │
├─────────────────────────┤
│ MINIPLAYER (fixo)       │
│ + botao maximizar ↗     │
├─────────────────────────┤
│ TEMPORADAS + EPISODIOS  │
│ (scrollavel)            │
└─────────────────────────┘
```
   - **renderMode** no `SeriesDetailContent`: controla o que renderizar.
     - `poster` — somente thumb + sinopse (topo mobile).
     - `episodes` — chips de temporada + busca + lista de episodios (scroll mobile).
     - `all` — tudo junto (desktop).
   - **Maximizar**: botao flutuante seta `maximized: true` -> player em tela cheia com botao minimizar.
   - **Nota**: no mobile, o botao maximizar so rotaciona a tela (pendente Fullscreen API).

### 4.6 Estados compartilhados

**Loading** (`shared/Loading.tsx`):
```
       ◌
   Carregando…
```
- Spinner: `h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-accent`.
- Mensagem: `text-sm text-zinc-400` (customizável via prop).

**Erro** (`shared/ErrorState.tsx`):
```
   Mensagem do erro em vermelho
       [ Tentar novamente ]
```
- Mensagem: `max-w-xs text-sm text-red-300`.
- Botão: `rounded-xl bg-surface px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-800 active:scale-[0.98]`.

**SectionTitle** (`shared/SectionTitle.tsx`):
- `<h2 className="px-4 pt-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">{children}</h2>` — separador de seção usado para "Mini guia" no player de TV.

---

## 5. Thumbs (logos e posters)

A aplicação consome três tipos de "thumb" vindos direto do painel
Xtream Codes, todos com URL absoluta HTTP/HTTPS retornada no JSON. O
backend não modifica essas URLs — elas vão do navegador direto para o
painel.

### 5.1 Logo de canal ao vivo

- **Origem**: campo `stream_icon` em `XtreamLiveStream` (API
  `get_live_streams`).
- **Onde aparece**:
  - Lista de canais (TV ao vivo) — `ChannelCard` em
    `LiveScreen.tsx:142`.
- **Tamanho no card**: `h-12 w-12` (48×48 px).
- **Render**:
  ```tsx
  <img
    src={channel.stream_icon}
    alt=""
    loading="lazy"
    className="h-12 w-12 shrink-0 rounded-lg bg-surface-2 object-contain"
    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
  />
  ```
- **Tratamento de falha**: o `<img>` é escondido (não remove o card).
  O `bg-surface-2` atrás dele serve para casos em que o canal não tem
  logo (o card fica com um quadradinho cinza-escuro no lugar).
- **Cache**: as imagens são carregadas direto pelo navegador e cacheadas
  pelo HTTP cache padrão. Como a maioria dos painéis Xtream hospeda logos
  em CDN, o carregamento é rápido após o primeiro acesso.

### 5.2 Poster de filme

- **Origem**: campo `stream_icon` em `XtreamVodStream` (API
  `get_vod_streams`).
- **Onde aparece**:
  - Grade de filmes — `MovieCard` em `MoviesScreen.tsx:240`.
  - (Opcional) Tela de reprodução do filme, se você reintroduzir
    `info.cover`.
- **Tamanho no card**: aspect ratio 2:3 (padrão de poster de filme).
- **Render**:
  ```tsx
  <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface ring-1 ring-zinc-800">
    <img
      src={movie.stream_icon}
      alt={movie.name}
      loading="lazy"
      className="h-full w-full object-cover transition group-active:scale-95"
      onError={...}
    />
  </div>
  ```
- **Tratamento de falha**: idem (esconde a imagem, o card fica com fundo
  `bg-surface`).
- **Dica de UX**: o `object-cover` cobre todo o retângulo 2:3,
  cortando a imagem se necessário. `object-contain` mostraria a imagem
  inteira com bandas pretas.

### 5.3 Capa de série

- **Origem**: campo `cover` em `XtreamSeries` (API `get_series`).
- **Onde aparece**:
  - Grade de séries — `SerieCard` em `SeriesScreen.tsx:198`.
  - Detalhe da série — capa vertical `h-40 w-28` em
    `SeriesDetail` (`SeriesScreen.tsx:336`), com fallback para
    `query.data.info.cover` se a cover principal falhar.
- **Render na grade**: mesma estética do poster de filme (2:3, rounded,
  ring).
- **Render no detalhe**: `h-40 w-28` (160×112 px), aspect ratio padrão
  de capa de série do painel.

### 5.4 Thumbs do menu principal

Não vêm do painel — são SVGs próprios armazenados em
`frontend/public/`:

```
frontend/public/
├── favicon.svg
├── tv-ao-vivo.svg        (300×300, gradiente vermelho)
├── filmes.svg            (300×300, gradiente azul)
└── series-novelas.svg    (300×300, gradiente roxo)
```

Cada SVG tem `role="img"` e `aria-label`. O atributo `viewBox="0 0 300
300"` permite escalar para qualquer tamanho. No menu eles são
renderizados com `className="h-3/5 w-3/5 object-contain"` dentro de
cartões `aspect-square`.

### 5.5 Onde esses thumbs são cacheados

- **Pelo navegador**: HTTP cache padrão baseado em `Cache-Control` do
  servidor de imagens do painel. Em geral os logos/posters são
  imutáveis por meses.
- **Pelo nosso backend**: nada. Não fazemos proxy nem cache de
  imagens. O navegador pega do painel direto.

---

## 6. EPG (Electronic Program Guide)

### 6.1 Origem dos dados

- **Backend**: `backend/src/iptv/epg.ts`.
  - Endpoint do painel: `{baseUrl}/xmltv.php?username={user}&password={pass}`.
  - Parser: `fast-xml-parser` v5.
  - **Cache em memória** com TTL de **30 minutos** (`EPG_CACHE_TTL_MS`).
  - Cache indexado por `session.token` (cada usuário tem seu próprio XMLTV cacheado).
- **Endpoints expostos**:
  - `GET /api/epg` — XMLTV completo parseado, retorna
    `{ generatedAt, channels: { [channelId]: { name, programmes: [...] } } }`.
  - `GET /api/epg/channel/:epg_channel_id` — apenas o canal específico.

### 6.2 Modelo de dados (TypeScript)

```ts
interface EpgProgramme {
  title: string
  description: string
  start: string          // original "YYYYMMDDHHMMSS +0000"
  stop: string
  start_timestamp: number  // ms epoch (já com offset aplicado)
  stop_timestamp: number
}

interface EpgChannel {
  name: string
  programmes: EpgProgramme[]
}

interface EpgData {
  generatedAt: number
  channels: Record<string /* epg_channel_id */, EpgChannel>
}
```

A função `parseXmltvDate` (`backend/src/iptv/epg.ts`) faz o parse do
formato "YYYYMMDDHHMMSS +0000" e já converte para `Date` em UTC, com
offset aplicado — assim `start_timestamp` é em **ms epoch** e pode ser
comparado com `Date.now()` diretamente.

### 6.3 Cruzamento canal ↔ EPG

- Cada `XtreamLiveStream` tem um campo `epg_channel_id` (string ou
  null).
- No frontend, `getChannelEpg(epgData, channel.epg_channel_id)` em
  `frontend/src/features/live/epg.ts:21` faz a busca direta em
  `epgData.channels[id]`.
- Se `epg_channel_id` for `null`/vazio, retorna `null` e o canal
  aparece na lista **sem** now/next.

### 6.4 Helpers no frontend (`features/live/epg.ts`)

```ts
// Acha o programa atual e o próximo
findNowNext(programmes): { now: EpgProgramme | null, next: EpgProgramme | null }

// Formata timestamp para "HH:MM" pt-BR
formatTime(timestamp): string

// Busca o canal de EPG correspondente a um canal ao vivo
getChannelEpg(epgData, epgChannelId): EpgChannel | null
```

`findNowNext` itera o array de programmes (já ordenados por
`start_timestamp` no backend) e retorna o primeiro cujo intervalo contém
o `Date.now()`.

### 6.5 Exibição

#### 6.5.1 Na lista de canais (`LiveScreen.tsx:142-175`)

Cada `ChannelCard` exibe, abaixo do nome do canal:
- **Agora** (se existir): horário + título do programa
  (`text-xs text-zinc-400`).
- **A seguir** (se existir): `"A seguir: <título>"`
  (`text-xs text-zinc-500`).

Exemplo:
```
[Logo] Globo SP
       21:30 Jornal Nacional
       A seguir: 22:00 Novela
```

#### 6.5.2 Na tela de reprodução (`LiveScreen.tsx:184-240`)

Logo abaixo do player:
- "AO VIVO • HH:MM - HH:MM" em `text-sm text-accent`.
- Título do programa atual em `text-lg font-semibold`.
- Descrição do programa em `text-sm leading-relaxed text-zinc-400`
  (se existir).

#### 6.5.3 Mini guia (`LiveScreen.tsx:215-237`)

Lista de até 8 próximos programas, dentro de um bloco `<SectionTitle>Mini
guia</SectionTitle>`:

- Container: `mt-2 space-y-2`.
- Item: `flex gap-3 rounded-xl bg-surface p-3`.
  - Horário: `w-14 shrink-0 text-sm text-zinc-500` (largura fixa de 56px para alinhar todos).
  - Título: `truncate font-medium`.
  - Descrição: `truncate text-xs text-zinc-500`.

### 6.6 Estado de erro / ausência

- Se o painel não tiver XMLTV (`xmltv.php` retorna vazio), `epgQuery.data`
  será `{ generatedAt, channels: {} }`. Os canais aparecem sem
  now/next e a tela de reprodução mostra "Programação não disponível."
  (`text-sm text-zinc-500`).
- Se a requisição do EPG falhar (rede), o React Query mantém o cache
  anterior ou mostra loading. Como o cache tem TTL de 5 min no
  frontend (`staleTime: 5 * 60_000`), a navegação entre canais não
  refaz a chamada.

---

## 7. Resumo de tokens reutilizáveis

Para reproduzir a identidade visual em outro projeto, basta:

1. **Tailwind v4** + plugin `@tailwindcss/vite`.
2. O bloco `@theme` com as 5 cores acima.
3. As 4 utilities `@utility pt-safe / pb-safe / pl-safe / pr-safe`.
4. Os 3 SVGs em `public/` (ou substitua pelos seus).
5. As classes descritas em cada seção (cards, listas, header, etc.).

A estrutura de pastas `features/{auth,live,movies,series}`, `shared`,
`player`, `api` é puramente organizacional — qualquer organização
equivalente funciona desde que cada feature exporte um componente de
tela.
