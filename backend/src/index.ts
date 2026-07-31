import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyRateLimit from '@fastify/rate-limit'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { authRoutes } from './routes/auth.js'
import { epgRoutes } from './routes/epg.js'
import { healthRoutes } from './routes/health.js'
import { imgRoutes } from './routes/img.js'
import { liveRoutes } from './routes/live.js'
import { movieRoutes } from './routes/movies.js'
import { seriesRoutes } from './routes/series.js'
import { transcodeRoutes } from './routes/transcode.js'
import { streamRoutes } from './routes/stream.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '127.0.0.1'
const frontendDist = path.resolve(__dirname, '../../frontend/dist')

const app = Fastify({
  // Logs de request/response do pino são muito ruídos (JSON por linha).
  // Mantemos só erros do framework; os logs legíveis de negócio
  // ([auth]/[stream]/[proxy]/[fallback]/[reauth]) são console.log limpos.
  // Esses logs vão SOMENTE para o console do backend (e backend.log),
  // jamais para o usuário final — respeita a regra de não vazar dados.
  logger: { level: 'error' },
  // Necessário para o rate limit (e qualquer outra lógica baseada em IP)
  // enxergar o IP real do cliente a partir do header X-Forwarded-For, já
  // que o backend roda atrás do Cloudflare Tunnel.
  trustProxy: true,
})

// Em desenvolvimento local, defina ALLOWED_ORIGIN=http://localhost:5173
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://novawebplayer.app'

app.addHook('onSend', async (req, reply, payload) => {
  const url = req.url ?? ''

  // --- Headers de segurança HTTP ---
  reply.raw.setHeader('X-Content-Type-Options', 'nosniff')
  reply.raw.setHeader('X-Frame-Options', 'DENY')
  reply.raw.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.raw.setHeader('X-XSS-Protection', '1; mode=block')
  // Strict-Transport-Security só em HTTPS (Cloudflare Tunnel serve HTTPS)
  reply.raw.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  const isAsset =
    req.method === 'GET' &&
    (url.startsWith('/assets/') ||
      url.endsWith('.js') ||
      url.endsWith('.css') ||
      url.endsWith('.svg') ||
      url.endsWith('.png') ||
      url.endsWith('.jpg') ||
      url.endsWith('.webp'))
  if (isAsset) {
    reply.raw.setHeader('Access-Control-Allow-Origin', '*')
    reply.raw.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  }
  if (url.startsWith('/stream/')) {
    reply.raw.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Range, Authorization')
    reply.raw.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
  }

  // index.html nunca pode ficar preso em cache do navegador (referencia
  // assets com hash no nome). Sem isso, GET /index.html direto sairia do
  // @fastify/static com o maxAge longo de 30d.
  const contentType = String(reply.getHeader('content-type') ?? '')
  if (req.method === 'GET' && contentType.startsWith('text/html')) {
    reply.header('cache-control', 'no-store')
  }
  return payload
})

// Limite global de taxa — rede de segurança básica para todas as rotas.
// Limites mais estritos (ex: /api/auth) são definidos por rota via
// `config.rateLimit` no próprio arquivo de rotas.
await app.register(fastifyRateLimit, {
  max: 300,
  timeWindow: '1 minute',
})

// Rota explícita para a raiz — tem prioridade sobre o wildcard do
// @fastify/static, então nunca cai no caso "diretório sem index" que
// retorna 403. Sempre serve o mesmo index.html fixo, sem cache.
app.get('/', (_req, reply) => {
  const indexPath = path.join(frontendDist, 'index.html')
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8')
    reply.header('content-type', 'text/html; charset=utf-8')
    reply.header('cache-control', 'no-store')
    return reply.send(html)
  }
  return reply.code(404).send({ error: 'Not found' })
})

// Serve os assets estáticos do build do frontend (JS/CSS/SVG/etc) de forma
// segura — o pacote 'send' usado internamente por @fastify/static já trata
// path traversal, symlinks fora da raiz, etc. Requisições para arquivos que
// não existem caem no setNotFoundHandler abaixo (fallback de SPA).
await app.register(fastifyStatic, {
  root: frontendDist,
  prefix: '/',
  index: false,
  cacheControl: true,
  maxAge: '30d',
  immutable: true,
})

await app.register(healthRoutes, { prefix: '/api' })
await app.register(authRoutes, { prefix: '/api' })
await app.register(liveRoutes, { prefix: '/api/live' })
await app.register(movieRoutes, { prefix: '/api/movies' })
await app.register(seriesRoutes, { prefix: '/api/series' })
await app.register(epgRoutes, { prefix: '/api/epg' })
await app.register(imgRoutes, { prefix: '/api' })
await app.register(transcodeRoutes, { prefix: '/transcode' })
await app.register(streamRoutes, { prefix: '/stream' })

// DEBUG: rota direta para testar se Fastify responde /stream
app.get('/stream/test', async () => { return { ok: true } })

app.setNotFoundHandler((req, reply) => {
  if (req.method !== 'GET') {
    return reply.code(404).send({ error: 'Not found' })
  }

  const urlPath = req.url.split('?')[0]

  if (
    urlPath.startsWith('/api') ||
    urlPath.startsWith('/stream') ||
    urlPath.startsWith('/transcode')
  ) {
    return reply.code(404).send({ error: 'Not found' })
  }

  // Fallback de SPA: qualquer rota GET não resolvida por @fastify/static
  // acima (ou seja, não é um asset real) recebe sempre o mesmo
  // index.html fixo, para o React Router assumir o roteamento no
  // cliente. NUNCA construir um caminho de arquivo a partir de
  // req.url/urlPath aqui — é exatamente isso que causava o path
  // traversal antes desta correção.
  const indexPath = path.join(frontendDist, 'index.html')
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8')
    reply.header('content-type', 'text/html; charset=utf-8')
    reply.header('cache-control', 'no-store')
    return reply.send(html)
  }

  return reply.code(404).send({ error: 'Not found' })
})

app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})
