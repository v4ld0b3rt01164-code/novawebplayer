# AGENTS.md — Web IPTV Player

Este arquivo orienta qualquer agente de codificação (Claude Code, etc.)
trabalhando neste repositório. Leia também `PRD.md` antes de qualquer
implementação — ele é a fonte de verdade de requisitos.

## Stack recomendada

- **Frontend**: React + Vite + TypeScript.
- **Estilo**: TailwindCSS (utilitário, fácil de manter responsivo/iOS-safe).
- **Player**: `<video>` HTML5 nativo + `hls.js` como fallback para navegadores
  sem suporte nativo a HLS (Safari/iOS **não** deve usar hls.js — usar
  reprodução nativa lá).
- **Estado/dados remotos**: React Query (cache, retry, stale-while-revalidate).
- **Parsing XMLTV**: parser XML leve no backend (ex.: `fast-xml-parser`),
  já que o backend é quem busca o `xmltv.php` de qualquer forma — evita
  mandar o XML bruto (potencialmente grande) para o navegador.
- **Backend**: Node.js (Express ou Fastify), rodando na máquina local do
  autor, exposto publicamente via **Cloudflare Tunnel** no domínio
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

## Estrutura de pastas sugerida

```
/frontend
  /src
    /api          -> client HTTP simples, fala SÓ com o backend próprio
                      (nunca com os domínios IPTV diretamente)
    /player       -> componentes de vídeo (LivePlayer, VodPlayer)
    /features
      /auth       -> tela de login
      /live       -> TV ao vivo (categorias, canais, EPG)
      /movies     -> Filmes (VOD)
      /series     -> Séries & Novelas (plataformas, temporadas, episódios)
    /shared       -> componentes de UI genéricos, ícones SVG do menu
    /types        -> tipagem TypeScript dos payloads (espelha o backend)

/backend
  /src
    /iptv
      servers.ts      -> lista dos 8 domínios candidatos (única fonte)
      auth.ts         -> lógica de fallback + autenticação Xtream Codes
      catalog.ts      -> proxy de live/vod/series (categorias, streams)
      epg.ts          -> busca e parse do xmltv.php, cache em memória
      proxy.ts        -> proxy dos streams (live/vod/series) + UpstreamHttpError
      reauth.ts       -> re-autenticação com single-flight (dedup por sessão)
      withFallback.ts -> wrapper de fallback para rotas de stream
    /routes           -> rotas HTTP expostas em novawebplayer.app/api/* e /stream/*
    /session          -> gestão de sessão do usuário logado -> servidor ativo
                        (+ blockedServers Set + updateSessionServer)
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

Veja `scripts/windows/README.md` para detalhes.

### Checkpoints (git)

O repositório é git local (sem remote). Estados estáveis validados recebem
tag `checkpoint-AAAA-MM-DD` — os builds (`dist/`) são commitados de
propósito para restauração imediata. Instruções completas de restauração e
de criação de novos checkpoints: `RESTORE_POINT.md`. Agentes NÃO devem
criar commits/tags sem pedido explícito do usuário (regra padrão), mas
devem atualizar `STATUS.md`, `SECURITY.md` e `RESTORE_POINT.md` ao concluir
mudanças relevantes.

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
