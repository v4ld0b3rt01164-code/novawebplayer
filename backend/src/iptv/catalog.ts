import { ApiError } from '../shared/errors.js'
import type { Session } from '../session/store.js'
import {
  type XtreamCategory,
  type XtreamEpisode,
  type XtreamLiveStream,
  type XtreamSeries,
  type XtreamSeriesInfoResponse,
  type XtreamShortEpgResponse,
  type XtreamVodInfoResponse,
  type XtreamVodStream,
} from './types.js'

const REQUEST_TIMEOUT_MS = 10_000

/**
 * Reescreve uma URL de imagem upstream (geralmente http://) para passar pelo
 * proxy do backend em /api/img?u=... (URL relativa, resolve para a mesma
 * origem https do frontend). Resolve Mixed Content em iOS/navegadores modernos.
 * Strings vazias ou não-URLs são devolvidas inalteradas.
 */
function proxyImage(url: string | undefined): string {
  if (!url) return url ?? ''
  if (!/^https?:\/\//i.test(url)) return url
  return `/api/img?u=${encodeURIComponent(url)}`
}

/** Versão para arrays de backdrop_path. */
function proxyImages(urls: string[] | undefined): string[] {
  if (!urls) return []
  return urls.map(proxyImage)
}

function buildXtreamUrl(
  session: Session,
  action: string,
  extra: Record<string, string | number | undefined> = {},
): URL {
  const url = new URL('/player_api.php', session.server.baseUrl)
  url.searchParams.set('username', session.server.username)
  url.searchParams.set('password', session.server.password)
  url.searchParams.set('action', action)
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url
}

async function xtreamFetch<T>(session: Session, action: string, extra?: Record<string, string | number | undefined>): Promise<T> {
  const url = buildXtreamUrl(session, action, extra)
  let res: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timer)
  } catch {
    throw new ApiError(0, 'Falha de rede ao consultar o painel.')
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Erro ${res.status} no painel`)
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new ApiError(500, 'Resposta inválida do painel.')
  }

  return payload as T
}

export async function getLiveCategories(
  session: Session,
): Promise<XtreamCategory[]> {
  return xtreamFetch<XtreamCategory[]>(session, 'get_live_categories')
}

export async function getLiveStreams(
  session: Session,
  categoryId?: string,
): Promise<XtreamLiveStream[]> {
  const extra: Record<string, string | number | undefined> = {}
  if (categoryId) extra.category_id = categoryId
  const streams = await xtreamFetch<XtreamLiveStream[]>(session, 'get_live_streams', extra)
  for (const s of streams) s.stream_icon = proxyImage(s.stream_icon)
  return streams
}

export async function getShortEpg(
  session: Session,
  streamId: number,
  limit = 4,
): Promise<XtreamShortEpgResponse> {
  return xtreamFetch<XtreamShortEpgResponse>(session, 'get_short_epg', {
    stream_id: streamId,
    limit,
  })
}

export async function getVodCategories(
  session: Session,
): Promise<XtreamCategory[]> {
  return xtreamFetch<XtreamCategory[]>(session, 'get_vod_categories')
}

export async function getVodStreams(
  session: Session,
  categoryId?: string,
): Promise<XtreamVodStream[]> {
  const extra: Record<string, string | number | undefined> = {}
  if (categoryId) extra.category_id = categoryId
  const streams = await xtreamFetch<XtreamVodStream[]>(session, 'get_vod_streams', extra)
  for (const s of streams) s.stream_icon = proxyImage(s.stream_icon)
  return streams
}

export async function getVodInfo(
  session: Session,
  vodId: number,
): Promise<XtreamVodInfoResponse> {
  const data = await xtreamFetch<XtreamVodInfoResponse>(session, 'get_vod_info', {
    vod_id: vodId,
  })
  if (data.info) data.info.cover = proxyImage(data.info.cover)
  return data
}

export async function getSeriesCategories(
  session: Session,
): Promise<XtreamCategory[]> {
  return xtreamFetch<XtreamCategory[]>(session, 'get_series_categories')
}

export async function getSeries(
  session: Session,
  categoryId?: string,
): Promise<XtreamSeries[]> {
  const extra: Record<string, string | number | undefined> = {}
  if (categoryId) extra.category_id = categoryId
  const series = await xtreamFetch<XtreamSeries[]>(session, 'get_series', extra)
  for (const s of series) {
    s.cover = proxyImage(s.cover)
    s.backdrop_path = proxyImages(s.backdrop_path)
  }
  return series
}

export async function getSeriesInfo(
  session: Session,
  seriesId: number,
): Promise<XtreamSeriesInfoResponse> {
  const data = await xtreamFetch<XtreamSeriesInfoResponse | { info: XtreamSeriesInfoResponse['info']; seasons: XtreamSeriesInfoResponse['seasons']; episodes: XtreamEpisode[] }>(
    session,
    'get_series_info',
    { series_id: seriesId },
  )

  // Alguns painéis devolvem episodes como objeto { '1': [...], '2': [...] },
  // outros como array. Normaliza para Record<string, XtreamEpisode[]>.
  const episodes =
    data.episodes && !Array.isArray(data.episodes)
      ? (data.episodes as Record<string, XtreamEpisode[]>)
      : {}

  if (data.info) {
    data.info.cover = proxyImage(data.info.cover)
    data.info.backdrop_path = proxyImages(data.info.backdrop_path)
  }
  if (data.episodes) {
    for (const season of Object.values(data.episodes as Record<string, XtreamEpisode[]>)) {
      for (const ep of season) {
        if (ep.info) ep.info.movie_image = proxyImage(ep.info.movie_image)
      }
    }
  }

  return {
    ...data,
    episodes,
  } as XtreamSeriesInfoResponse
}
