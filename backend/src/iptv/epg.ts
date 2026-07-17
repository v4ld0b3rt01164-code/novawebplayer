import { XMLParser } from 'fast-xml-parser'
import { ApiError } from '../shared/errors.js'
import type { Session } from '../session/store.js'

export interface EpgProgramme {
  title: string
  description: string
  start: string
  stop: string
  start_timestamp: number
  stop_timestamp: number
}

export interface EpgChannel {
  name: string
  programmes: EpgProgramme[]
}

export interface EpgData {
  generatedAt: number
  channels: Record<string, EpgChannel>
}

const EPG_CACHE_TTL_MS = 30 * 60 * 1000 // 30 min
const EPG_TIMEOUT_MS = 20_000

const epgCache = new Map<string, EpgData>()

function parseXmltvDate(value: string | undefined): Date {
  if (!value) return new Date(0)
  // Formatos comuns: 20240115120000 +0000 / 20240115120000 -0300
  const clean = value.trim()
  const year = Number(clean.slice(0, 4))
  const month = Number(clean.slice(4, 6)) - 1
  const day = Number(clean.slice(6, 8))
  const hour = Number(clean.slice(8, 10))
  const minute = Number(clean.slice(10, 12))
  const second = Number(clean.slice(12, 14))
  const tzPart = clean.slice(15, 20)
  let tzOffset = 0
  if (tzPart) {
    const sign = tzPart[0] === '+' ? 1 : -1
    const tzHours = Number(tzPart.slice(1, 3))
    const tzMinutes = Number(tzPart.slice(3, 5))
    tzOffset = sign * (tzHours * 60 + tzMinutes) * 60_000
  }
  const localMs = Date.UTC(year, month, day, hour, minute, second)
  return new Date(localMs - tzOffset)
}

function getText(node: unknown): string {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'object' && node !== null && '#text' in node) {
    return String((node as { '#text': unknown })['#text'])
  }
  return String(node)
}

function normalizeArray<T>(node: T | T[] | undefined): T[] {
  if (node === undefined || node === null) return []
  return Array.isArray(node) ? node : [node]
}

async function fetchXmltv(session: Session): Promise<string> {
  const url = new URL('/xmltv.php', session.server.baseUrl)
  url.searchParams.set('username', session.server.username)
  url.searchParams.set('password', session.server.password)

  let res: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), EPG_TIMEOUT_MS)
    res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timer)
  } catch {
    throw new ApiError(0, 'Falha de rede ao buscar EPG.')
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Erro ${res.status} ao buscar EPG.`)
  }

  return res.text()
}

function parseXmltv(xml: string): EpgData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
    trimValues: true,
  })
  const doc = parser.parse(xml) as {
    tv?: {
      channel?: unknown | unknown[]
      programme?: unknown | unknown[]
    }
  }

  const channels: Record<string, EpgChannel> = {}

  for (const raw of normalizeArray(doc.tv?.channel)) {
    if (typeof raw !== 'object' || raw === null) continue
    const channel = raw as {
      '@_id'?: string
      'display-name'?: unknown | unknown[]
    }
    const id = channel['@_id']
    if (!id) continue
    const names = normalizeArray(channel['display-name'])
    channels[id] = {
      name: getText(names[0]) || id,
      programmes: [],
    }
  }

  for (const raw of normalizeArray(doc.tv?.programme)) {
    if (typeof raw !== 'object' || raw === null) continue
    const prog = raw as {
      '@_start'?: string
      '@_stop'?: string
      '@_channel'?: string
      title?: unknown | unknown[]
      desc?: unknown | unknown[]
    }
    const channelId = prog['@_channel']
    if (!channelId || !channels[channelId]) continue

    const titles = normalizeArray(prog.title)
    const descs = normalizeArray(prog.desc)

    const startDate = parseXmltvDate(prog['@_start'])
    const stopDate = parseXmltvDate(prog['@_stop'])

    channels[channelId].programmes.push({
      title: getText(titles[0]) || 'Programação desconhecida',
      description: getText(descs[0]) || '',
      start: prog['@_start'] || '',
      stop: prog['@_stop'] || '',
      start_timestamp: startDate.getTime(),
      stop_timestamp: stopDate.getTime(),
    })
  }

  for (const channel of Object.values(channels)) {
    channel.programmes.sort((a, b) => a.start_timestamp - b.start_timestamp)
  }

  return { generatedAt: Date.now(), channels }
}

/**
 * Retorna o EPG parseado, usando cache em memória de 30 min.
 * Em caso de falha, retorna o cache anterior se ainda houver.
 */
export async function getFullEpg(session: Session): Promise<EpgData> {
  const key = session.token
  const cached = epgCache.get(key)
  if (cached && Date.now() - cached.generatedAt < EPG_CACHE_TTL_MS) {
    return cached
  }

  try {
    const xml = await fetchXmltv(session)
    const data = parseXmltv(xml)
    epgCache.set(key, data)
    return data
  } catch (err) {
    if (cached) return cached
    throw err
  }
}

export async function getChannelEpg(
  session: Session,
  epgChannelId: string | null | undefined,
): Promise<EpgChannel | null> {
  if (!epgChannelId) return null
  const epg = await getFullEpg(session)
  return epg.channels[epgChannelId] ?? null
}

export function findNowNext(programmes: EpgProgramme[]): {
  now: EpgProgramme | null
  next: EpgProgramme | null
} {
  const now = Date.now()
  const currentIndex = programmes.findIndex(
    (p) => p.start_timestamp <= now && p.stop_timestamp > now,
  )
  return {
    now: currentIndex >= 0 ? programmes[currentIndex] : null,
    next: currentIndex >= 0 ? programmes[currentIndex + 1] ?? null : null,
  }
}
