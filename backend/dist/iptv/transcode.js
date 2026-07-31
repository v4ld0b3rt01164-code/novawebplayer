/**
 * Pipeline de vídeo baseado em ffmpeg.
 *
 * Para LIVE: faz download completo do .m3u8 upstream (que tem segmentos
 * protegidos por sessão do painel) e gera HLS local com -c copy
 * (sem re-encoding, rápido).
 *
 * Para MOVIE/SERIES: baixa o arquivo upstream e gera MP4 local com
 * transcodificacao para H.264/AAC (resolve codec incompatível).
 *
 * O frontend consome sempre /transcode/<type>/<file>?token=<uuid> e
 * recebe HLS apenas para LIVE e MP4 progressivo para VOD.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, unlinkSync, } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const TMP_BASE = path.join(os.tmpdir(), 'novawebplayer-transcode');
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';
const IDLE_TIMEOUT_MS = 300_000; // 5 min sem acesso = encerrar
const states = new Map();
function buildUpstreamUrl(session, type, file) {
    const { baseUrl, username, password } = session.server;
    const basePath = type === 'live' ? 'live' : type;
    return `${baseUrl}/${basePath}/${username}/${password}/${file}`;
}
function key(session, type, file) {
    return `${session.token}::${type}::${file}`;
}
function logKey(session, type, file) {
    return `${session.token.slice(0, 8)}...::${type}::${file}`;
}
function maskTranscodeError(message) {
    return message.replace(/(https?:\/\/[^/\s]+\/(?:live|movie|series)\/)[^/\s]+\/[^/\s]+/gi, '$1****/****');
}
function safeDir(session, type, file) {
    const safeFile = file.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(TMP_BASE, session.token, type, safeFile);
}
async function ensureDir(dir) {
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
}
async function waitForFirstSegment(dir, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const files = await readdir(dir).catch(() => []);
        if (files.some((f) => f.endsWith('.ts') || f.endsWith('.m4s')))
            return true;
        await new Promise((r) => setTimeout(r, 250));
    }
    return false;
}
/**
 * Inicia (ou reutiliza) o pipeline ffmpeg para o stream.
 * Retorna o diretório onde o resultado transcodificado é gerado.
 */
export async function startTranscode(session, type, file) {
    const k = key(session, type, file);
    const existing = states.get(k);
    if (existing) {
        if (!existing.failed && !(existing.completed && type === 'live')) {
            existing.lastAccess = Date.now();
            return existing.dir;
        }
        states.delete(k);
    }
    const dir = safeDir(session, type, file);
    await ensureDir(dir);
    // Limpa arquivos de uma execução anterior
    const old = await readdir(dir).catch(() => []);
    for (const f of old) {
        try {
            unlinkSync(path.join(dir, f));
        }
        catch {
            // ignore
        }
    }
    const playlist = path.join(dir, 'index.m3u8');
    const segPattern = path.join(dir, 'seg_%05d.ts');
    const output = vodPath(dir);
    const upstreamUrl = buildUpstreamUrl(session, type, file);
    const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-user_agent', 'NovaWebPlayer/1.0',
        '-headers', 'Accept: */*\r\n',
        '-i', upstreamUrl,
    ];
    if (type === 'live') {
        // Live: copy de codecs para máxima velocidade.
        // O upstream geralmente entrega H.264/AAC, que todos os browsers aceitam.
        args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ac', '2');
    }
    else {
        // VOD/Séries: entrega MP4 progressivo H.264/AAC (resolve HEVC/AC3)
        // para que Safari preserve a semantica de VOD e suporte seek via Range.
        args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-g', '60', '-sc_threshold', '0', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', '-f', 'mp4');
    }
    if (type === 'live') {
        args.push('-f', 'hls', '-hls_time', '4', '-hls_list_size', '6', '-hls_flags', 'temp_file', '-hls_segment_filename', segPattern, playlist);
    }
    else {
        args.push(output);
    }
    const proc = spawn(FFMPEG_BIN, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    let finish;
    const completion = new Promise((resolve) => {
        finish = resolve;
    });
    const state = {
        proc,
        dir,
        type,
        file,
        lastAccess: Date.now(),
        session,
        completed: false,
        failed: false,
        completion,
    };
    states.set(k, state);
    let stderrTail = '';
    proc.stderr?.on('data', (chunk) => {
        stderrTail = `${stderrTail}${chunk.toString('utf8')}`.slice(-4000);
    });
    proc.on('error', (err) => {
        state.failed = true;
        finish(false);
        console.error('[transcode] erro ao iniciar ffmpeg:', err.message);
    });
    proc.on('exit', (code) => {
        const detail = maskTranscodeError(stderrTail.trim());
        console.log(`[transcode] ffmpeg saiu (code=${code}) key=${logKey(session, type, file)}${detail ? ` erro=${detail}` : ''}`);
        if (code === 0) {
            state.completed = true;
            finish(true);
            return;
        }
        if (type === 'live' && Date.now() - state.lastAccess < 120_000) {
            console.log(`[transcode] reiniciando ffmpeg para ${logKey(session, type, file)}`);
            states.delete(k);
            finish(false);
            startTranscode(state.session, type, file).catch((err) => {
                console.error('[transcode] falha ao reiniciar:', err.message);
            });
        }
        else {
            state.failed = true;
            finish(false);
        }
    });
    // Limpeza automática
    scheduleIdleCleanup();
    return dir;
}
let cleanupTimer = null;
function scheduleIdleCleanup() {
    if (cleanupTimer)
        return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [k, s] of states) {
            if (now - s.lastAccess > IDLE_TIMEOUT_MS) {
                console.log(`[transcode] encerrando ocioso: ${logKey(s.session, s.type, s.file)}`);
                try {
                    s.proc.kill('SIGKILL');
                }
                catch {
                    // ignore
                }
                states.delete(k);
                rmSync(s.dir, { recursive: true, force: true });
            }
        }
    }, 30_000);
    cleanupTimer.unref?.();
}
export function touch(session, type, file) {
    const s = states.get(key(session, type, file));
    if (s)
        s.lastAccess = Date.now();
}
export function getDir(session, type, file) {
    return safeDir(session, type, file);
}
export function playlistPath(dir) {
    return path.join(dir, 'index.m3u8');
}
export function vodPath(dir) {
    return path.join(dir, 'output.mp4');
}
export function vodStat(dir) {
    if (!existsSync(vodPath(dir)))
        return null;
    return statSync(vodPath(dir));
}
export function readVodStream(dir, start, end) {
    return createReadStream(vodPath(dir), { start, end });
}
export function segmentPath(dir, segment) {
    // Anti path traversal
    if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
        throw new Error('Segmento inválido.');
    }
    return path.join(dir, segment);
}
export function readPlaylistStream(dir) {
    return createReadStream(playlistPath(dir));
}
export function readSegmentStream(dir, segment) {
    return createReadStream(segmentPath(dir, segment));
}
export function segmentStat(dir, segment) {
    const p = segmentPath(dir, segment);
    if (!existsSync(p))
        return null;
    return statSync(p);
}
export async function waitForFirstSeg(dir, timeoutMs = 20_000) {
    return waitForFirstSegment(dir, timeoutMs);
}
export async function waitForVodTranscode(session, type, file, timeoutMs = 300_000) {
    const state = states.get(key(session, type, file));
    if (!state)
        return false;
    if (state.completed)
        return vodStat(state.dir) !== null;
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        state.completion.then((success) => {
            clearTimeout(timer);
            resolve(success && vodStat(state.dir) !== null);
        });
    });
}
//# sourceMappingURL=transcode.js.map