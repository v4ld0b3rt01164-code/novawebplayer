import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { requireStreamAuth } from './streamAuth.js'
import {
  getDir,
  playlistPath,
  readSegmentStream,
  segmentPath,
  segmentStat,
  startTranscode,
  touch,
  vodStat,
  readVodStream,
  waitForVodTranscode,
  waitForFirstSeg,
} from '../iptv/transcode.js'

type ByteRange = { start: number; end: number }
type ByteRangeResult = ByteRange | 'invalid' | null

function parseByteRange(header: string | undefined, size: number): ByteRangeResult {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || size === 0 || (!match[1] && !match[2])) return 'invalid'

  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return 'invalid'
    return {
      start: Math.max(size - suffixLength, 0),
      end: size - 1,
    }
  }

  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return 'invalid'
  }

  return { start, end: Math.min(requestedEnd, size - 1) }
}

const transcodeRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  app.addHook('preHandler', requireStreamAuth)

  // /transcode/live/<stream_id>.m3u8
  // /transcode/movie/<stream_id>.<ext> -> MP4 progressivo
  // /transcode/series/<stream_id>.<ext> -> MP4 progressivo
  app.get('/:type/:file', async (req, reply) => {
    const { type, file } = req.params as { type: string; file: string }
    if (!['live', 'movie', 'series'].includes(type)) {
      return reply.status(400).send({ error: 'Tipo inválido.' })
    }
    const session = req.session!

    if (type === 'movie' || type === 'series') {
      const dir = await startTranscode(session, type, file)
      const ready = await waitForVodTranscode(session, type, file)
      if (!ready) {
        return reply.status(504).send({
          error: 'Tempo esgotado aguardando a conversao do VOD.',
        })
      }

      touch(session, type, file)
      const stat = vodStat(dir)
      if (!stat) {
        return reply.status(502).send({ error: 'VOD convertido nao encontrado.' })
      }

      const range = parseByteRange(req.headers.range, stat.size)
      if (range === 'invalid') {
        reply.header('content-range', `bytes */${stat.size}`)
        return reply.status(416).send()
      }

      const start = range?.start ?? 0
      const end = range?.end ?? stat.size - 1
      reply.header('content-type', 'video/mp4')
      reply.header('accept-ranges', 'bytes')
      reply.header('content-length', String(end - start + 1))
      reply.header('cache-control', 'no-store')
      if (range) {
        reply.header('content-range', `bytes ${start}-${end}/${stat.size}`)
      }
      return reply
        .status(range ? 206 : 200)
        .send(readVodStream(dir, start, end))
    }

    const dir = await startTranscode(
      session,
      type as 'live' | 'movie' | 'series',
      file,
    )

    const ready = await waitForFirstSeg(dir, 25_000)
    if (!ready) {
      return reply.status(504).send({
        error: 'Tempo esgotado aguardando geração do HLS.',
      })
    }

    touch(session, type, file)

    // Reescreve o m3u8 gerado pelo ffmpeg para que cada segmento aponte
    // para uma URL absoluta do nosso backend com ?token=...
    const playlist = playlistPath(dir)
    const raw = await readFile(playlist, 'utf-8')
    const origin = `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers.host}`
    const tokenQuery = `token=${session.token}`

    const rewritten = raw.replace(
      /^(\s*)(\S+\.(?:ts|m3u8|m4s|mp4|m4a|aac))(\s*)$/gim,
      (_m: string, lead: string, url: string, trail: string) => {
        const sep = url.includes('?') ? '&' : '?'
        return `${lead}${origin}/transcode/seg/${type}/${file}/${url}${sep}${tokenQuery}${trail}`
      },
    )

    void reply.header('content-type', 'application/vnd.apple.mpegurl')
    void reply.header('cache-control', 'no-store')
    return reply.send(rewritten)
  })

  // /transcode/seg/<type>/<file>/<segment>
  app.get('/seg/:type/:file/:segment', async (req, reply) => {
    const { type, file, segment } = req.params as {
      type: string
      file: string
      segment: string
    }
    if (!['live', 'movie', 'series'].includes(type)) {
      return reply.status(400).send({ error: 'Tipo inválido.' })
    }
    const session = req.session!

    touch(session, type, file)

    const dir = getDir(session, type as 'live' | 'movie' | 'series', file)
    const p = segmentPath(dir, segment)
    if (!existsSync(p)) {
      return reply.status(404).send({ error: 'Segmento não encontrado.' })
    }

    const stat = segmentStat(dir, segment)
    if (!stat) {
      return reply.status(404).send({ error: 'Segmento não encontrado.' })
    }

    void reply.header('content-type', 'video/mp2t')
    void reply.header('content-length', String(stat.size))
    void reply.header('cache-control', 'no-store')
    return reply.send(readSegmentStream(dir, segment))
  })
}

export default transcodeRoutes
export { transcodeRoutes }
