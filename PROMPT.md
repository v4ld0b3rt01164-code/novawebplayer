# PROMPT.md — Kickoff para o agente de codificação

> Use este prompt para iniciar a implementação do projeto com um agente de
> codificação (ex.: Claude Code), depois de ele ter acesso a `PRD.md` e
> `AGENTS.md` no repositório.

---

Você vai construir o **Web IPTV Player** descrito em `PRD.md`, seguindo
todas as convenções de `AGENTS.md`. Leia os dois arquivos por completo antes
de escrever qualquer código.

## Contexto rápido

- É um cliente web de painéis IPTV compatíveis com **Xtream Codes API**.
- Login: **apenas usuário e senha**. A URL do servidor é composta
  automaticamente, testando uma lista de domínios candidatos em fallback até
  um autenticar com sucesso.
- Após login: menu com **TV AO VIVO**, **FILMES**, **SÉRIES & NOVELAS**
  (ícones SVG serão fornecidos separadamente).
- TV ao vivo: canais agrupados por categoria vinda da API, com EPG
  (now/next) via XMLTV.
- Filmes: grid por categoria, player mp4.
- Séries: agrupadas por categoria (que funcionam como "plataformas" —
  Globoplay, Netflix, Amazon etc.), episódios agrupados por temporada.
- **Requisito crítico: compatibilidade total com iOS/Safari**, incluindo
  playback de HLS nativo e `playsinline`.
- **Arquitetura definida**: já existe domínio próprio (`novawebplayer.app`)
  na Cloudflare com um **Cloudflare Tunnel** para uma máquina local. O
  projeto terá um **backend próprio** (Node) rodando nessa máquina,
  exposto via túnel, que funciona como proxy/gateway entre o frontend
  (HTTPS) e os painéis IPTV (HTTP) — isso resolve o problema de mixed
  content no iOS e centraliza a lógica de fallback entre os 8 domínios.
  O frontend só conhece `https://novawebplayer.app`. Ver PRD seção 3 para
  o diagrama completo.

## Ordem de execução sugerida

Trabalhe em fatias verticais, na ordem abaixo, confirmando build/lint a cada
etapa antes de avançar:

1. **Setup dos dois projetos** (`/frontend` com Vite + React + TS +
   Tailwind, `/backend` com Node + Express/Fastify), estrutura de pastas
   conforme `AGENTS.md`.
2. **Backend — módulo IPTV** (`/backend/src/iptv`): tipos Xtream Codes,
   lista de domínios candidatos, função de autenticação com fallback,
   cache do "servidor ativo" por sessão. Expor rota
   `POST /api/auth` que recebe usuário/senha e retorna sessão.
3. **Tela de login (frontend)**: dois campos (usuário/senha), chamando
   `POST /api/auth` do próprio backend. Estado de loading e erro claro se
   o backend não conseguir autenticar em nenhum domínio.
4. **Backend — catálogo e EPG**: rotas para live/vod/series
   (categorias e listas) e para EPG (busca + parse do `xmltv.php`,
   cruzando com `epg_channel_id`), sempre delegando ao domínio ativo da
   sessão.
5. **Backend — proxy de streams**: rota que resolve a URL real do stream
   (live `.m3u8`, VOD/série `.mp4`) no domínio ativo e a serve via HTTPS
   ao frontend (ver PRD seção 10 para a decisão proxy vs redirect).
6. **Menu principal** pós-login com os três botões (usar placeholders de
   ícone até os SVGs reais serem integrados).
7. **TV ao vivo**: listagem de categorias → canais → player HLS, consumindo
   as rotas do backend. Implementar o player já pensando em iOS desde o
   início (não deixar para depois).
8. **EPG**: exibição now/next e mini-guia, consumindo dados já parseados
   pelo backend.
9. **Filmes (VOD)**: categorias → grid → player mp4.
10. **Séries & Novelas**: categorias/plataformas → séries → temporadas →
    episódios → player mp4.
11. **Polimento responsivo/iOS**: revisão final de toques, safe-areas
    (`env(safe-area-inset-*)` para notch/home indicator), fullscreen,
    comportamento em orientação retrato/paisagem.
12. **Operação**: configurar reinício automático do backend (systemd/pm2)
    e um healthcheck simples, já que a máquina local é ponto único de
    falha (PRD seção 14, risco 5).

## Regras que você deve seguir sem exceção

- Nunca hardcode um único domínio — sempre usar o módulo central de
  fallback.
- Live sempre via `.m3u8`, nunca `.ts` bruto.
- `<video>` sempre com `playsInline`, e `muted` quando houver autoplay.
- Nunca logar ou expor credenciais.
- Categorias/agrupamentos vêm dinamicamente da API, nunca fixos em código.
- Tratamento de erro obrigatório em toda chamada de rede (servidores de
  IPTV são instáveis por natureza).

## Ao terminar cada etapa

Pare, resuma o que foi implementado, rode lint/build/typecheck, e só então
siga para a próxima etapa da lista. Se encontrar uma decisão de arquitetura
não coberta pelo PRD (ex.: estratégia final para o problema de mixed
content HTTP/HTTPS), pare e pergunte antes de prosseguir.
