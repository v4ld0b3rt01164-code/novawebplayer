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
  categoryId: string,
): Promise<XtreamLiveStream[]> {
  return xtreamFetch<XtreamLiveStream[]>(session, 'get_live_streams', {
    category_id: categoryId,
  })
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
  return xtreamFetch<XtreamVodStream[]>(session, 'get_vod_streams', extra)
}

export async function getVodInfo(
  session: Session,
  vodId: number,
): Promise<XtreamVodInfoResponse> {
  return xtreamFetch<XtreamVodInfoResponse>(session, 'get_vod_info', {
    vod_id: vodId,
  })
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
  return xtreamFetch<XtreamSeries[]>(session, 'get_series', extra)
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

  return {
    ...data,
    episodes,
  } as XtreamSeriesInfoResponse
}
