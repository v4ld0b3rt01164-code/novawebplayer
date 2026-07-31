# SECURITY.md — NOVA Web Player

Documento de seguranca do projeto. Criado em: 2026-07-17.
Ultima atualizacao: 2026-07-31 (ordem aleatoria de autenticacao documentada).
Baseado em auditoria completa do codigo-fonte (frontend + backend).

---

## O que foi analisado

A auditoria verificou os seguintes pontos em todo o codigo-fonte:

### Frontend (`frontend/src/`)

| Verificacao | Metodo |
|---|---|
| Presenca de dominios IPTV (liderpremium.xyz, etc) em qualquer arquivo | Busca por string nos arquivos .ts/.tsx |
| Credenciais (username/password) trafegando para dominios externos | Rastreamento de chamadas fetch/post |
| Uso de localStorage/sessionStorage | Busca por string nos arquivos .ts/.tsx |
| URL de stream construida com token | Analise de `api/streamUrl.ts` |
| Mensagens de erro exibidas ao usuario | Analise de componentes de UI (ErrorState, LoginScreen, VideoPlayer) |
| Tipos expostos (XtreamAuthResponse, server_info) | Analise de `types/index.ts` |
| Configuracao de proxy/cors no Vite | Analise de `vite.config.ts` |
| Build final (dist/) expoe algo sensivel | Verificacao do bundle gerado |

### Backend (`backend/src/`)

| Verificacao | Metodo |
|---|---|
| Dominios IPTV em unico arquivo de config | Analise de `iptv/servers.ts` |
| Credenciais enviadas ao IPTV (auth, catalog, epg) | Rastreamento de chamadas HTTP no backend |
| Validacao de token em todas as rotas protegidas | Verificacao de hooks `preHandler` em cada rota |
| Mensagens de erro genericas (sem vazamento) | Analise de blocos catch em routes/ |
| Logs que expoe credenciais | Analise de console.log/console.error |
| Headers de seguranca HTTP | Verificacao de headers em responses |
| CORS configurado | Verificacao de headers CORS em rotas |
| Sessao em memoria (validade, expiracao) | Analise de `session/store.ts` |
| Path traversal em endpoints de stream | Verificacao de validacao de caminhos |
| Rate limiting | Verificacao de existencia |
| Input validation nos parametros de rota | Verificacao de tratamento de query params |

### Arquitetura geral

| Verificacao | Metodo |
|---|---|
| Frontend fala com backend (mesma origem) | Verificacao de chamadas relativas (`/api/...`, `/stream/...`) |
| Backend e unico ponto de contato com IPTV | Verificacao de fluxo de dados |
| Cloudflare Tunnel (HTTPS forçado) | Verificacao de config.yml |
| PM2 gerencia processos | Verificacao de ecosystem config |
| Scripts Windows nao expoe credenciais | Analise dos .bat/.ps1 |

A arquitetura de seguranca do projeto e solida. O frontend nunca se comunica
diretamente com dominios IPTV — toda trafegada pelo backend via proxy.
Credenciais, tokens e URLs de stream estao devidamente isolados.

| Verificacao | Status |
|---|---|
| Dominios IPTV nao expostos no frontend | OK |
| Credenciais so trafegam no backend | OK |
| URLs de stream tokenizadas | OK |
| Nada sensivel em localStorage/sessionStorage | OK |
| Mensagens de erro seguras (sem vazamento) | OK |
| Token validado em todas as rotas protegidas | OK |

---

## Achados para avaliar

Abaixo estão os achados menores identificados na auditoria, com severidade,
impacto e proposta de correcao para cada um.

---

### 1. Logs do backend com credenciais — IMPLEMENTADO

**Severidade**: BAIXA
**Arquivos**: `backend/src/routes/stream.ts`
**Data da correcao**: 2026-07-17

**Problema**: `console.error` e `console.log` gravam URLs upstream completas,
que contem usuario e senha no path (formato: `{baseUrl}/live/{user}/{pass}/{file}`).
Nao chega ao usuario final, mas se logs forem encaminhados para servico externo
(ex.: Datadog, Sentry, CloudWatch), credenciais sao expostas em texto plano.

**Correcao aplicada**: Funcao `maskUrl()` inline em `stream.ts` que usa `new URL()`
+ splitting de path para mascarar a senha (segmento 4) antes de logar URLs upstream.
Exemplo: `https://server.com/live/user123/myPass/12345.ts` → `https://server.com/live/user123/****/12345.ts`

**Status**: ✅ Implementado e validado.

---

### 2. server_info retornado no login — IMPLEMENTADO

**Severidade**: BAIXA
**Arquivos**: `backend/src/routes/auth.ts`, `frontend/src/types/index.ts`
**Data da correcao**: 2026-07-17

**Problema**: A resposta de login inclui `server_info` do painel IPTV
(url, port, https_url, server_protocol, rtmp_port). O frontend nao usa
esses dados em nenhum componente visivel, mas ficam acessiveis via DevTools
e no payload da requisicao.

**Correcao aplicada**: Removido `server_info` da resposta em `auth.ts`
(retorna apenas `{ token, user_info }`). Interface `XtreamServerInfo` e campo
`server_info` removidos de `XtreamAuthResponse` no frontend.
O backend continua usando `XtreamServerInfo` internamente em `iptv/types.ts`
para parse da resposta IPTV.

**Status**: ✅ Implementado e validado.

---

### 3. CORS wildcard `*` em rotas de stream — IMPLEMENTADO

**Severidade**: BAIXA a MEDIA
**Arquivos**: `backend/src/index.ts`, `backend/src/routes/stream.ts`
**Data da correcao**: 2026-07-17

**Problema**: `Access-Control-Allow-Origin: *` em todas as rotas de stream.
Funcional para o caso atual (token opaco UUID), mas nao e restritivo.
Se no futuro o projeto usar cookies para autenticacao, isso vira uma
vulnerabilidade real.

**Correcao aplicada**: CORS para rotas `/stream/` agora usa variavel de ambiente
`ALLOWED_ORIGIN` (default: `https://novawebplayer.app`). Headers CORS duplicados
foram removidos de `stream.ts` e centralizados no `onSend` hook de `index.ts`.
Assets estaticos continuam com `*` (nao sao sensiveis).
Em dev local, defina `ALLOWED_ORIGIN=http://localhost:5173`.

**Status**: ✅ Implementado e validado.

---

### 4. Sem headers de seguranca HTTP — PARCIALMENTE IMPLEMENTADO

**Severidade**: BAIXA
**Arquivos**: `backend/src/index.ts`
**Data da correcao**: 2026-07-17

**Problema**: O backend nao configura headers de seguranca HTTP.

**Headers implementados no `onSend` hook:**
- ✅ `X-Content-Type-Options: nosniff` (previne MIME sniffing)
- ✅ `X-Frame-Options: DENY` (previne clickjacking)
- ✅ `Referrer-Policy: strict-origin-when-cross-origin` (controle de referrer)
- ✅ `X-XSS-Protection: 1; mode=block` (protecao adicional, legado)
- ✅ `Strict-Transport-Security: max-age=31536000; includeSubDomains` (forca HTTPS)

**Pendente:**
- ⏸️ `Content-Security-Policy` — Requer estudo cuidadoso para nao quebrar hls.js,
scripts inline do player e carregamento de imagens de servidores IPTV.
Recomenda-se comecar em modo `report-only` e adicionar gradualmente.

**Status**: ✅ 5/6 headers implementados. CSP pendente de estudo.

---

### 5. Token na query string

**Severidade**: BAIXA (trade-off necessario)
**Arquivos**: `frontend/src/api/streamUrl.ts:12,20,28`

**Problema**: Token de sessao trafega como `?token=uuid` na URL.
Aparece no historico do navegador, logs de acesso do servidor, e
potencialmente em logs de CDN/proxy.

**Por que e necessario**: `<video>` HTML5 e hls.js nao conseguem enviar
headers customizados (`Authorization: Bearer`). A query string e a unica
forma viavel de autenticar streams em players nativos.

**Correcao proposta**: Nenhuma viavel sem quebrar o player.
Alternativa teorica: usar cookies SameSite=Strict + CSRF token, mas
requer reformulacao significativa e nao compativel com todos os browsers.

**Recomendacao**: Manter como esta. Documentar o trade-off.

---

### 6. Sessoes em memoria — IMPLEMENTADO

**Severidade**: INFORMATIVA
**Arquivos**: `backend/src/session/store.ts`
**Data da correcao**: 2026-07-19

**Problema**: Sessoes ficavam em um `Map` em memoria do processo.
Todas sao perdidas no restart do servidor. Nao escala horizontalmente.

**Correcao aplicada**: Sessoes sao persistidas em disco (`backend/sessions.json`)
com debounced write (1s). Na inicializacao, sessoes sao carregadas do disco.
Sessoes expiradas sao descartadas no load. Sobrevivem a restarts do backend,
PM2 e watchdog.

**Status**: ✅ Implementado.

---

### 7. Path traversal no static file serving — IMPLEMENTADO

**Severidade**: ALTA
**Arquivos**: `backend/src/index.ts`
**Data da correcao**: 2026-07-17

**Problema**: O `setNotFoundHandler` montava `path.join(frontendDist, urlPath)`
com `urlPath` derivado diretamente de `req.url`, sem sanitizacao. `path.join`
colapsa `..`, entao `GET /../../../../etc/passwd` resolvia para fora de
`frontendDist` e o handler devolvia o conteudo via `readFileSync` — leitura
arbitraria de arquivos, sem autenticacao, exposta publicamente via tunnel.

**Correcao aplicada**:
- Removido todo o bloco que lia arquivo com caminho derivado de `req.url`
  (incluindo o dicionario `MIME` manual).
- Assets estaticos agora servidos por `@fastify/static` (root fixo em
  `frontendDist`, `index: false`, cache 30d immutable) — o pacote trata
  path traversal e symlinks fora da raiz (retorna 403 para `..`).
- Rota explicita `GET /` serve o `index.html` fixo (prioridade sobre o
  wildcard do static, evita 403 de "diretorio sem index").
- `setNotFoundHandler` mantem apenas o fallback de SPA: sempre o mesmo
  `index.html` fixo com `cache-control: no-store`, nunca caminho calculado.
- Hook `onSend` forca `no-store` em qualquer resposta `text/html` (cobre
  `GET /index.html` direto, que sairia do static com cache longo).

**Validacao**: `curl --path-as-is /../../backend/package.json` → 403 sem
conteudo; variante URL-encoded (`%2e%2e`) → 403; home, SPA fallback e
assets funcionando; validado em producao.

**Status**: ✅ Implementado e validado.

---

### 8. Rate limiting — IMPLEMENTADO

**Severidade**: MEDIA
**Arquivos**: `backend/src/index.ts`, `backend/src/routes/auth.ts`,
`backend/package.json`
**Data da correcao**: 2026-07-17

**Problema**: Nenhum rate limiting. `POST /api/auth` itera ate 8 dominios
com timeout de 5s cada (~40s por request no pior caso) — vetor barato de
esgotamento de conexoes e de brute-force de credenciais contra os paineis
IPTV upstream usando o proprio servidor como proxy.

**Correcao aplicada**:
- `@fastify/rate-limit@^11.1.0` registrado globalmente: **300 req/min**
  (rede de seguranca contra abuso grosseiro, nao incomoda uso normal).
- Limite estrito em `POST /api/auth` via `config.rateLimit`: **5 req/min
  por IP** (folga para usuario legitimo errar senha, inviabiliza
  brute-force).
- `trustProxy: true` no Fastify para o rate limit enxergar o IP real do
  cliente via `X-Forwarded-For` do Cloudflare Tunnel (sem isso, todos os
  clientes compartilhariam o mesmo balde do IP local do tunnel).
- Estouro do limite responde `429 Too Many Requests` (JSON padrao do
  plugin + header `Retry-After`).

**Validacao**: 6 logins errados seguidos → 5x 401, 6a requisicao → 429.

**Status**: ✅ Implementado e validado.

---

### 9. Ordem aleatoria dos servidores de autenticacao — IMPLEMENTADO

**Tipo**: comportamento de resiliencia
**Arquivos**: `backend/src/iptv/auth.ts`, `backend/src/iptv/servers.ts`
**Data da implementacao**: 2026-07-31

**Comportamento**: a cada chamada de `authenticate()`, o backend cria uma
copia dos candidatos, remove os dominios bloqueados da sessao e embaralha o
resultado com Fisher-Yates usando `crypto.randomInt`. O primeiro dominio que
responder HTTP 200 com `user_info.auth === 1` se torna o servidor ativo.

**Fallback**: se o dominio sorteado falhar, os demais sao tentados na mesma
ordem aleatoria. A reautenticacao automatica de streams usa a mesma funcao e
continua respeitando `blockedServers`.

**Seguranca**: a lista de dominios continua somente no backend. A
randomizacao nao altera o transporte das credenciais, os tokens de sessao ou
as mensagens de erro.

**Validacao**: `npm run typecheck` e `npm run build` aprovados; `npm run lint`
aprovado com aviso preexistente de import nao utilizado em
`backend/src/routes/transcode.ts`.

**Status**: Implementado e validado.

---

### 10. Monitor local de sessoes — IMPLEMENTADO

**Tipo**: observabilidade local
**Arquivo**: `monitor-server.bat`
**Data da implementacao**: 2026-07-31

O monitor le somente `backend/sessions.json` e considera ativas as sessoes
cujo `expiresAt` ainda nao expirou. Exibe apenas o `server.baseUrl`, o inicio
e a expiracao da sessao. Usuario, senha e token nunca sao impressos.

O monitor nao cria rota HTTP, nao faz requisicoes externas e deve ser
executado somente por quem possui acesso local a pasta do projeto.

**Status**: Implementado e validado.

---

## Resumo para decisao

| Achado | Severidade | Status | Correcao |
|---|---|---|---|
| 1. Logs com credenciais | Baixa | ✅ Implementado | maskUrl() em stream.ts |
| 2. server_info no login | Baixa | ✅ Implementado | Removido de auth.ts e frontend types |
| 3. CORS wildcard | Baixa/Media | ✅ Implementado | ALLOWED_ORIGIN env var em index.ts |
| 4. Headers de seguranca | Baixa | ✅ Parcial | 5/6 headers em onSend hook. CSP pendente |
| 5. Token na query string | Baixa | ⏸️ Mantido | Trade-off necessario para player nativo |
| 6. Sessoes em memoria | Informativa | ✅ Implementado | Persistencia em disco (sessions.json) com debounced write |
| 7. Path traversal no static serving | Alta | ✅ Implementado | @fastify/static + rota / explicita + SPA fallback fixo |
| 8. Sem rate limiting | Media | ✅ Implementado | @fastify/rate-limit: 300/min global + 5/min no login + trustProxy |

**Status geral**: 6 de 8 achados resolvidos. Itens 5 e 6 sao trade-offs aceitaveis.
Item 4 (CSP) requer estudo adicional antes de implementar.
Pendencia adicional conhecida: limite de processos ffmpeg concorrentes em
`iptv/transcode.ts` (risco medio, tarefa separada).

---

## Regras de seguranca (existentes e enforceadas)

1. Frontend nunca fala diretamente com dominios IPTV.
2. Credenciais so trafegam em `POST /api/auth` (backend para IPTV).
3. Token UUID opaco (gerado via `randomUUID()`), TTL 24h, persistido em disco.
4. Nenhum uso de localStorage/sessionStorage para dados sensiveis.
5. Mensagens de erro nao expoe senha, dominio ou detalhes do servidor.
6. Dominios IPTV ficam em um unico arquivo (`servers.ts`), nao espalhados.
7. Stream URLs reescritas pelo backend (credenciais IPTV nunca chegam ao frontend).
