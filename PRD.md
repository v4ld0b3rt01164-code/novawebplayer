# PRD — Web IPTV Player

## 1. Visão Geral

Aplicação web (SPA) que funciona como cliente de painéis IPTV compatíveis com a
**API Xtream Codes**. O usuário faz login apenas com **usuário e senha**; a
aplicação compõe automaticamente as URLs de API/stream a partir de uma lista
de domínios candidatos, com fallback automático entre eles.

A aplicação deve ser **100% compatível com iOS** (Safari mobile e "Adicionar à
Tela de Início" / PWA), além de funcionar bem em desktop e Android.

## 2. Objetivo

Entregar um player de IPTV no navegador com:
- Login simplificado (sem o usuário precisar saber/informar servidor);
- Catálogo de TV ao vivo, Filmes e Séries/Novelas, com categorização e
  agrupamento;
- EPG (guia de programação) integrado aos canais ao vivo;
- Player HLS robusto e compatível com iOS.

## 3. Arquitetura de Deploy (definida)

O projeto já conta com:
- Domínio próprio na Cloudflare: **novawebplayer.app**;
- **Cloudflare Tunnel** apontando para uma máquina local, que serve as
  requisições.

Isso muda (e resolve) a decisão de arquitetura pendente da seção 9 sobre
mixed content HTTP/HTTPS: **o navegador nunca deve falar diretamente com os
domínios dos painéis IPTV (`liderpremium.xyz` etc.)**. Em vez disso:

```
[Navegador] --HTTPS--> novawebplayer.app --(Cloudflare Tunnel)--> [Backend local]
                                                                        |
                                                                        v
                                                        [Painéis IPTV via HTTP]
                                                (liderpremium.xyz, lidertv.xyz, ...)
```

- O **backend local** (exposto via túnel em `novawebplayer.app`) atua como
  **proxy reverso/API gateway**:
  - Recebe requisições HTTPS do frontend (auth, catálogo, EPG, e
    idealmente também os streams);
  - Repassa para o domínio IPTV ativo via HTTP;
  - Devolve a resposta ao navegador via HTTPS — resolvendo mixed content
    e CORS de uma vez.
- A **lógica de fallback entre os 8 domínios passa a viver no backend**, não
  mais no frontend (mais rápido, não expõe os domínios reais no
  DevTools/Network do navegador, e facilita cache/retry server-side).
- O frontend só conhece um endpoint: `https://novawebplayer.app/api/...`
  (e, se os streams também forem proxiados, `https://novawebplayer.app/stream/...`).

> Decisão em aberto (ver seção 13): **proxiar também os streams de vídeo**
> (live/VOD) pelo backend, ou só a API de dados (catálogo/EPG) e deixar o
> player buscar o stream diretamente? Proxiar tudo é mais simples/seguro
> para iOS, mas coloca toda a banda de streaming passando pela máquina
> local + túnel. Ver seção 13 para trade-offs.

## 4. Domínios candidatos (fallback, agora resolvidos pelo backend)

A aplicação deve manter uma lista central de domínios-base, embaralhar uma
cópia dessa lista a cada autenticação e testar os domínios até obter sucesso:

```
http://liderpremium.xyz/
http://lidertv.xyz/
http://pipocashowp.com/
http://doubtzh.com/
http://poptour.xyz/
http://popcornplay.xyz/
http://hxqab.xyz/
http://aqphx.xyz/
```

> Nota: os endpoints são servidos em `http://` (não `https://`). Essa lista
> agora é conhecida e gerenciada pelo **backend** (ver seção 3), não pelo
> navegador — o frontend nunca faz requisição direta a esses domínios.

## 5. Fluxo de Login

1. Usuário digita **usuário** e **senha** (dois campos, nada mais) no
   frontend.
2. Frontend envia usuário/senha para o **próprio backend**
   (`https://novawebplayer.app/api/auth`), nunca diretamente para os
   domínios IPTV.
3. **Backend** embaralha a lista de domínios candidatos e tenta cada um nessa
   nova ordem, chamando internamente:
   ```
   {DOMINIO}/player_api.php?username={user}&password={pass}
   ```
4. Critério de sucesso: resposta HTTP 200 + JSON com
   `user_info.auth === 1`.
5. Timeout curto por tentativa no backend (ex.: 5s) para não travar o
   fallback.
6. Primeiro domínio que autenticar com sucesso é:
   - Salvo em cache no **backend** (memória/arquivo/DB simples) como
     "servidor ativo" — associado à sessão do usuário logado, para reuso nas
     chamadas seguintes (catálogo, EPG, streams) sem repetir o fallback a
     cada requisição;
   - Usado pelo backend para compor todas as URLs subsequentes.
7. Backend responde ao frontend com um token/sessão própria (ex.: JWT ou
   cookie de sessão) — o frontend não precisa saber qual domínio IPTV foi
   usado.
8. Se **todos** os domínios falharem: backend retorna erro claro, e o
   frontend exibe mensagem amigável ("Não foi possível conectar a nenhum
   servidor. Verifique usuário/senha ou tente novamente mais tarde").
9. Credenciais originais (usuário/senha do painel) trafegam **apenas**
   entre frontend e backend via HTTPS, e do backend para os domínios IPTV
   via HTTP (única perna insegura, mitigada por estar fora do navegador).
   Nunca logar credenciais em console/analytics/logs persistentes.

### Composição de URLs (padrão Xtream Codes)

- **Autenticação / dados do painel**:
  `{DOMINIO}/player_api.php?username={user}&password={pass}`
- **Categorias de TV ao vivo**:
  `.../player_api.php?username=&password=&action=get_live_categories`
- **Canais ao vivo por categoria**:
  `.../player_api.php?...&action=get_live_streams&category_id={id}`
- **Categorias de VOD (Filmes)**:
  `.../player_api.php?...&action=get_vod_categories`
- **Filmes por categoria**:
  `.../player_api.php?...&action=get_vod_streams&category_id={id}`
- **Categorias de Séries**:
  `.../player_api.php?...&action=get_series_categories`
- **Séries por categoria**:
  `.../player_api.php?...&action=get_series&category_id={id}`
- **Detalhe de série (temporadas/episódios)**:
  `.../player_api.php?...&action=get_series_info&series_id={id}`
- **EPG completo (XMLTV)**:
  `.../xmltv.php?username={user}&password={pass}`
- **EPG curto por canal (opcional/otimização)**:
  `.../player_api.php?...&action=get_short_epg&stream_id={id}&limit=4`

### URLs de stream (origem, no painel IPTV — uso interno do backend)

- **Live**: `{DOMINIO}/live/{user}/{pass}/{stream_id}.m3u8` (preferir `.m3u8`
  em vez de `.ts` — ver seção 10)
- **Filme (VOD)**: `{DOMINIO}/movie/{user}/{pass}/{stream_id}.{ext}`
  (`ext` normalmente `mp4`, vem no campo `container_extension` do JSON)
- **Episódio de série**: `{DOMINIO}/series/{user}/{pass}/{episode_id}.{ext}`

O frontend **não usa essas URLs diretamente**. O backend expõe equivalentes
próprias, ex.: `https://novawebplayer.app/stream/live/{stream_id}.m3u8`,
que internamente resolve para o domínio ativo e faz o proxy/redirect do
conteúdo (ver seção 3 e seção 10 para a decisão de proxiar vs redirecionar
os streams).

## 6. Menu Principal (pós-login)

Três botões grandes (assets SVG já existentes do usuário):
- **TV AO VIVO**
- **FILMES**
- **SÉRIES & NOVELAS**

Layout responsivo, tocável (mínimo 44x44px de área de toque — guideline da
Apia para iOS), sem depender de hover.

## 7. TV ao Vivo

- Canais agrupados por **categoria** (`category_name` retornado pela API).
  Exemplos de categorias esperadas no painel: ABERTOS, ESPORTES, NOTÍCIAS,
  GLOBO SUDESTE, GLOBO NORDESTE, FILMES E SÉRIES, DOCUMENTÁRIOS, VARIEDADES.
  A app **não deve fixar essa lista em código** — deve renderizar
  dinamicamente qualquer categoria devolvida pelo painel, apenas com uma
  ordenação/priorização configurável (ex.: ABERTOS e ESPORTES no topo).
- Cada canal exibe logo (`stream_icon`), nome e, quando disponível,
  programa atual/próximo via EPG (short EPG ou XMLTV cruzado por
  `epg_channel_id`).
- Player: HLS (ver seção 8).

## 8. Filmes (VOD)

- Agrupados por categoria (`vod_categories`), grid com poster
  (`stream_icon`/`cover`), título, ano, e sinopse quando disponível
  (`get_vod_info` opcional para detalhes).
- Player: mp4 progressivo/HLS conforme `container_extension`.

## 9. Séries & Novelas

- Agrupadas por categoria — e as categorias, nesse caso, funcionam como
  **plataformas** (ex.: Globoplay, Netflix, Amazon Prime), pois é assim que
  o painel Xtream normalmente organiza. A UI deve:
  - Exibir a lista de "plataformas" (categorias de série) como filtro/aba
    principal;
  - Dentro de cada plataforma, grid de séries.
- Ao abrir uma série: chamar `get_series_info` e agrupar episódios por
  **temporada** (`season` no JSON de resposta), exibindo abas/seções
  "Temporada 1", "Temporada 2" etc. Séries sem divisão de temporada exibem
  lista simples de episódios.

## 10. Player — Requisitos Técnicos Críticos (iOS)

| Conteúdo | Formato de origem | Estratégia recomendada |
|---|---|---|
| Live | HLS (.m3u8) via TS segments | `<video>` nativo em Safari/iOS (suporte HLS nativo); `hls.js` como polyfill em Chrome/Firefox/Edge desktop |
| Filmes | mp4 | `<video>` nativo (mp4 é suportado nativamente em todos os browsers/iOS) |
| Séries | mp4 | `<video>` nativo |

**Pontos de atenção específicos de iOS:**
- Não usar `.ts` bruto (MPEG-TS direto) como fonte de `<video>` — iOS Safari
  não decodifica isso nativamente e o suporte a MSE para TS bruto é
  inconsistente. Sempre solicitar/usar a variante `.m3u8` do painel para
  live.
- `autoplay` só funciona em iOS com `muted` + `playsinline`. Usar sempre o
  atributo `playsinline` no `<video>` para evitar fullscreen forçado.
- Testar reprodução em segundo plano/lock screen (Media Session API) se for
  requisito.
- **Mixed content resolvido pela arquitetura** (ver seção 3): o navegador só
  fala HTTPS com `novawebplayer.app`; o backend, exposto via Cloudflare
  Tunnel, é quem fala HTTP com os domínios IPTV. Falta decidir apenas:
  - **Streams também proxiados** pelo backend (URL final tipo
    `https://novawebplayer.app/stream/live/{id}.m3u8`, todo o tráfego de
    vídeo passa pela máquina local); ou
  - Backend só resolve a URL real e devolve ao frontend um **redirect** ou
    a URL para o player consumir — nesse caso a URL final ainda pode ser
    `http://`, reintroduzindo o problema de mixed content no iOS.
  **Recomendação**: proxiar os streams pelo backend (primeira opção), para
  garantir 100% de compatibilidade iOS mesmo que isso consuma mais banda
  da máquina/túnel local (ver seção 14, risco de capacidade).
- Gestos de fullscreen em iOS usam controles nativos do `<video>`
  (`webkit-playsinline`); não depender de fullscreen custom via CSS/JS puro.

## 11. EPG

- Fonte: `xmltv.php` (XML no formato XMLTV padrão).
- Parse client-side (ou via função serverless/edge, se o XML for grande)
  cruzando `channel id` do XMLTV com `epg_channel_id` de cada canal do
  `get_live_streams`.
- Exibir "agora/a seguir" na listagem de canais e um mini-guia (grade de
  horários) ao abrir um canal.
- Cache do EPG (ex.: 30–60 min) para evitar recarregar o XML completo a
  cada navegação — arquivo pode ser grande.

## 12. Requisitos Não Funcionais

- **Compatibilidade iOS** (Safari 15+, PWA "Adicionar à Tela de Início").
- Responsivo: mobile, tablet, desktop, smart TV browser (se aplicável).
- Performance: lazy loading de imagens/listas grandes (categorias com
  centenas de canais/filmes).
- Resiliência: fallback de servidor (login e, idealmente, também em falha de
  stream durante reprodução).
- Sem exposição de credenciais em logs/URLs visíveis desnecessariamente.

## 13. Fora de Escopo (v1)

- Multi-perfil por usuário/PIN infantil.
- Download offline.
- Chromecast/AirPlay nativo (pode entrar em v2 — AirPlay via Safari é quase
  "de graça" com `<video>` nativo, vale avaliar cedo).
- Múltiplas contas/painéis salvos simultaneamente (v1 é 1 conta ativa por
  vez).

## 14. Riscos Técnicos (resumo)

1. ~~HTTP vs HTTPS mixed content no iOS~~ — **resolvido** pela arquitetura
   de backend + Cloudflare Tunnel (seção 3). Falta só decidir se streams
   também são proxiados (ver seção 10).
2. **Live `.ts` vs `.m3u8`** — garantir que o painel realmente oferece saída
   `.m3u8` estável para todos os canais.
3. **Tamanho do XMLTV** — pode ser pesado; medir antes de decidir estratégia
   de parse (backend, já que ele fará a chamada de qualquer forma).
4. **Nomenclatura de categorias inconsistente entre painéis/domínios de
   fallback** — os 8 domínios podem não ter exatamente as mesmas
   categorias/conteúdo; validar se são espelhos do mesmo conteúdo ou painéis
   distintos.
5. **Máquina local como ponto único de falha**: se o backend local ou o
   túnel caírem, a aplicação inteira fica fora do ar (login, catálogo e,
   se proxiados, os streams). Vale considerar: monitoramento simples
   (healthcheck), reinício automático do serviço (systemd/pm2), e um plano
   de contingência caso a máquina fique offline.
6. **Capacidade de banda/CPU da máquina local**: se os streams de vídeo
   forem proxiados pelo backend (recomendado para iOS), todo o tráfego de
   vídeo de todos os usuários simultâneos passa pela conexão de upload da
   máquina local via túnel. Isso pode ser o gargalo real de escala — medir
   a banda de upload disponível e o número esperado de usuários
   simultâneos antes de decidir se todos os streams passam pelo proxy ou
   se uma abordagem híbrida é necessária (ex.: proxiar só metadados/HLS
   playlist e deixar os segmentos de vídeo irem direto, se algum dia os
   painéis oferecerem HTTPS nativo).
