/**
 * Pipeline de vídeo baseado em ffmpeg.
 *
 * Para LIVE: faz download completo do .m3u8 upstream (que tem segmentos
 * protegidos por sessão do painel) e gera HLS local com -c copy
 * (sem re-encoding, rápido).
 *
 * Para MOVIE/SERIES: baixa o MP4 upstream e gera HLS local com
 * transcodificação para H.264/AAC (resolve codec incompatível).
 *
 * O frontend consome sempre /transcode/<type>/<file>?token=<uuid> e
 * o player recebe um HLS local em H.264/AAC.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, statSync, createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type { Session } from '../session/store.js'

const TMP_BASE = path.join(os.tmpdir(), 'novawebplayer-transcode')
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg'
const IDLE_TIMEOUT_MS = 300_000 // 5 min sem acesso = encerrar

interface TranscodeState {
  proc: ChildProcess
  dir: string
  type: 'live' | 'movie' | 'series'
  file: string
  lastAccess: number
  session: Session
}

const states = new Map<string, TranscodeState>()

function buildUpstreamUrl(
  session: Session,
  type: 'live' | 'movie' | 'series',
  file: string,
): string {
  const { baseUrl, username, password } = session.server
  const basePath = type === 'live' ? 'live' : type
  return `${baseUrl}/${basePath}/${username}/${password}/${file}`
}

function key(session: Session, type: string, file: string): string {
  return `${session.token}::${type}::${file}`
}

function safeDir(session: Session, type: string, file: string): string {
  const safeFile = file.replace(/[^a-zA-Z0-9._-]/g, '_')
  return path.join(TMP_BASE, session.token, type, safeFile)
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function waitForFirstSegment(dir: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const files = await readdir(dir).catch(() => [])
    if (files.some((f) => f.endsWith('.ts') || f.endsWith('.m4s'))) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/**
 * Inicia (ou reutiliza) o pipeline ffmpeg para o stream.
 * Retorna o diretório onde o m3u8 e os segmentos são gerados.
 */
export async function startTranscode(
  session: Session,
  type: 'live' | 'movie' | 'series',
  file: string,
): Promise<string> {
  const k = key(session, type, file)
  const existing = states.get(k)
  if (existing) {
    existing.lastAccess = Date.now()
    return existing.dir
  }

  const dir = safeDir(session, type, file)
  await ensureDir(dir)

  // Limpa arquivos de uma execução anterior
  const old = await readdir(dir).catch(() => [])
  for (const f of old) {
    try {
      require('node:fs').unlinkSync(path.join(dir, f))
    } catch {
      // ignore
    }
  }

  const playlist = path.join(dir, 'index.m3u8')
  const segPattern = path.join(dir, 'seg_%05d.ts')

  const upstreamUrl = buildUpstreamUrl(session, type, file)

  const args: string[] = [
    '-hide_banner',
    '-loglevel', 'error',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', upstreamUrl,
  ]

  if (type === 'live') {
    // Live: copy de codecs para máxima velocidade.
    // O upstream geralmente entrega H.264/AAC, que todos os browsers aceitam.
    args.push(
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ac', '2',
    )
  } else {
    // VOD/Séries: transcodifica para H.264/AAC (resolve HEVC/AC3).
    args.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-g', '60',
      '-sc_threshold', '0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ac', '2',
    )
  }

  args.push(
    '-f', 'hls',
    '-hls_time', type === 'live' ? '4' : '6',
    '-hls_list_size', type === 'live' ? '6' : '0',
    '-hls_flags', 'temp_file',
    '-hls_segment_filename', segPattern,
    playlist,
  )

  const proc = spawn(FFMPEG_BIN, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  proc.stderr?.on('data', () => {
    // silencioso: ffmpeg já imprime com -loglevel error
  })

  proc.on('error', (err) => {
    console.error('[transcode] erro ao iniciar ffmpeg:', err.message)
  })

  proc.on('exit', (code) => {
    console.log(`[transcode] ffmpeg saiu (code=${code}) key=${k}`)
    const state = states.get(k)
    if (state && code !== 0 && Date.now() - state.lastAccess < 120_000) {
      console.log(`[transcode] reiniciando ffmpeg para ${k}`)
      states.delete(k)
      startTranscode(state.session, type, file).catch((err) => {
        console.error('[transcode] falha ao reiniciar:', err.message)
      })
    } else {
      states.delete(k)
    }
  })

  states.set(k, { proc, dir, type, file, lastAccess: Date.now(), session })

  // Limpeza automática
  scheduleIdleCleanup()

  return dir
}

let cleanupTimer: NodeJS.Timeout | null = null
function scheduleIdleCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [k, s] of states) {
      if (now - s.lastAccess > IDLE_TIMEOUT_MS) {
        console.log(`[transcode] encerrando ocioso: ${k}`)
        try {
          s.proc.kill('SIGKILL')
        } catch {
          // ignore
        }
        states.delete(k)
        require('node:fs').rmSync(s.dir, { recursive: true, force: true })
      }
    }
  }, 30_000)
  cleanupTimer.unref?.()
}

export function touch(session: Session, type: string, file: string): void {
  const s = states.get(key(session, type, file))
  if (s) s.lastAccess = Date.now()
}

export function getDir(
  session: Session,
  type: 'live' | 'movie' | 'series',
  file: string,
): string {
  return safeDir(session, type, file)
}

export function playlistPath(dir: string): string {
  return path.join(dir, 'index.m3u8')
}

export function segmentPath(dir: string, segment: string): string {
  // Anti path traversal
  if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
    throw new Error('Segmento inválido.')
  }
  return path.join(dir, segment)
}

export function readPlaylistStream(dir: string) {
  return createReadStream(playlistPath(dir))
}

export function readSegmentStream(dir: string, segment: string) {
  return createReadStream(segmentPath(dir, segment))
}

export function segmentStat(dir: string, segment: string) {
  const p = segmentPath(dir, segment)
  if (!existsSync(p)) return null
  return statSync(p)
}

export async function waitForFirstSeg(
  dir: string,
  timeoutMs = 20_000,
): Promise<boolean> {
  return waitForFirstSegment(dir, timeoutMs)
}
