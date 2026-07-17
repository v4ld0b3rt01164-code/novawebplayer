/**
 * Proxy puro para streams IPTV — SEM ffmpeg.
 *
 * Descobre o servidor real de streaming (IP interno) via redirect do .ts,
 * depois proxya m3u8 + segmentos por lá. O Cloudflare bloqueia /hls/...
 * mas o servidor real os serve normalmente.
 */

import type { Session } from '../session/store.js'

/**
 * Erro tipado para respostas HTTP não-OK do upstream. Permite que as rotas
 * decidam se vale a pena tentar fallback (401/403) ou não (5xx, timeout).
 */
export class UpstreamHttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'UpstreamHttpError'
    this.status = status
  }
}

function buildUpstreamBase(
  session: Session,
  type: 'live' | 'movie' | 'series',
): string {
  const { baseUrl, username, password } = session.server
  const basePath = type === 'live' ? 'live' : type
  return `${baseUrl}/${basePath}/${username}/${password}`
}

export function buildUpstreamUrl(
  session: Session,
  type: 'live' | 'movie' | 'series',
  file: string,
): string {
  return `${buildUpstreamBase(session, type)}/${file}`
}

/**
 * Cache de IP real do servidor de streaming por domínio.
 * Descoberto via redirect do endpoint .ts direto.
 */
const realServerCache = new Map<string, string>()

async function discoverRealServer(
  session: Session,
  type: 'live' | 'movie' | 'series',
  file: string,
): Promise<string> {
  const base = buildUpstreamBase(session, type)
  const tsId = file.replace(/\.\w+$/, '')
  const tsUrl = `${base}/${tsId}.ts`
  const cacheKey = session.server.baseUrl

  const cached = realServerCache.get(cacheKey)
  if (cached) return cached

  const res = await fetch(tsUrl, {
    redirect: 'manual',
    headers: { 'User-Agent': 'NovaWebPlayer/1.0' },
    signal: AbortSignal.timeout(10_000),
  })

  if (res.status === 401 || res.status === 403) {
    throw new UpstreamHttpError(
      res.status,
      `Descoberta de servidor real bloqueada (${res.status}) em ${cacheKey}`,
    )
  }

  const location = res.headers.get('location')
  if (!location) {
    throw new Error('Redirect do .ts não retornou Location header')
  }

  const realUrl = new URL(location)
  const realBase = `${realUrl.protocol}//${realUrl.host}`
  realServerCache.set(cacheKey, realBase)
  console.log(`[proxy] servidor real descoberto: ${realBase}`)
  return realBase
}

export async function fetchRewrittenPlaylist(
  session: Session,
  type: 'live' | 'movie' | 'series',
  file: string,
  backendOrigin: string,
  token: string,
): Promise<string> {
  const upstreamBase = buildUpstreamBase(session, type)
  const upstreamUrl = `${upstreamBase}/${file}`

  const res = await fetch(upstreamUrl, {
    headers: { 'User-Agent': 'NovaWebPlayer/1.0', Accept: '*/*' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new UpstreamHttpError(res.status, `Upstream retornou ${res.status} para ${type}/${file}`)
  }

  const raw = await res.text()
  const tokenQuery = `token=${encodeURIComponent(token)}`

  const rewritten = raw.replace(
    /^(?!#)(\s*)(\S+\.(?:ts|m3u8|m4s|m4a|aac|vtt))(\s*)$/gim,
    (_m: string, lead: string, segUrl: string, trail: string) => {
      return `${lead}${backendOrigin}/stream/seg/${type}/${file}/${encodeURIComponent(segUrl)}${trail.includes('?') ? '&' : '?'}${tokenQuery}${trail}`
    },
  )

  return rewritten
}

export async function resolveSegmentUrl(
  session: Session,
  type: 'live' | 'movie' | 'series',
  file: string,
  segment: string,
): Promise<string> {
  const realBase = await discoverRealServer(session, type, file)
  const segName = decodeURIComponent(segment)
  return `${realBase}${segName}`
}

export async function fetchUpstreamSegment(
  upstreamUrl: string,
): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; contentLength: string }> {
  let res: Response
  try {
    res = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'NovaWebPlayer/1.0', Accept: '*/*' },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e: any) {
    throw new Error(`Fetch falhou: ${e.message}`)
  }

  if (!res.ok) {
    throw new UpstreamHttpError(res.status, `Upstream retornou ${res.status} para segmento`)
  }

  if (!res.body) {
    throw new Error('Resposta upstream sem body')
  }

  return {
    stream: res.body,
    contentType: res.headers.get('content-type') ?? 'video/mp2t',
    contentLength: res.headers.get('content-length') ?? '0',
  }
}

export async function fetchUpstreamRaw(
  upstreamUrl: string,
  rangeHeader?: string | null,
): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; contentLength: string; status: number; contentRange: string | null }> {
  const headers: Record<string, string> = {
    'User-Agent': 'NovaWebPlayer/1.0',
    Accept: '*/*',
  }
  if (rangeHeader) {
    headers['Range'] = rangeHeader
  }

  let res: Response
  try {
    res = await fetch(upstreamUrl, { headers })
  } catch (e: any) {
    throw new Error(`Fetch falhou: ${e.message}`)
  }

  if (!res.ok && res.status !== 206) {
    throw new UpstreamHttpError(res.status, `Upstream retornou ${res.status}`)
  }

  if (!res.body) {
    throw new Error('Resposta upstream sem body')
  }

  return {
    stream: res.body,
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    contentLength: res.headers.get('content-length') ?? '0',
    status: res.status,
    contentRange: res.headers.get('content-range'),
  }
}
