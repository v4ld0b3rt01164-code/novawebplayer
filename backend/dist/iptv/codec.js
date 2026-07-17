import { spawn } from 'node:child_process';
import { ApiError } from '../shared/errors.js';
const FFPROBE_TIMEOUT_MS = 15_000;
const FFPROBE_BIN = process.env.FFPROBE_BIN || 'ffprobe';
function buildUpstreamUrl(session, type, relativePath) {
    const { baseUrl, username, password } = session.server;
    const basePath = type === 'live' ? 'live' : type;
    return new URL(`/${basePath}/${username}/${password}/${relativePath}`, baseUrl).toString();
}
function runFfprobe(url) {
    return new Promise((resolve, reject) => {
        const args = [
            '-v',
            'error',
            '-headers',
            'User-Agent: Mozilla/5.0',
            '-show_entries',
            'stream=codec_name,codec_type',
            '-show_entries',
            'format=format_name',
            '-of',
            'default=noprint_wrappers=1:nokey=0',
            '-timeout',
            String(FFPROBE_TIMEOUT_MS / 1000),
            url,
        ];
        const proc = spawn(FFPROBE_BIN, args);
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error('ffprobe timeout'));
        }, FFPROBE_TIMEOUT_MS + 2000);
        proc.stdout.on('data', (d) => (stdout += d.toString()));
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0)
                resolve(stdout);
            else
                reject(new Error(`ffprobe exit ${code}: ${stderr}`));
        });
    });
}
const VIDEO_COMPATIBLE = new Set(['h264', 'vp8', 'vp9', 'av1']);
const AUDIO_COMPATIBLE = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac']);
export async function probeStream(session, type, relativePath) {
    const url = buildUpstreamUrl(session, type, relativePath);
    let output;
    try {
        output = await runFfprobe(url);
    }
    catch (err) {
        throw new ApiError(0, `Não foi possível inspecionar o stream: ${err instanceof Error ? err.message : String(err)}`);
    }
    let video = null;
    let audio = null;
    let container = null;
    for (const rawLine of output.split('\n')) {
        const line = rawLine.trim();
        if (!line)
            continue;
        if (line.startsWith('codec_name=')) {
            // não sabemos se é v ou a pelo nome; usa ordem dos streams
            // ffprobe imprime streams na ordem. Pegamos primeiro v, depois a.
            const codec = line.slice('codec_name='.length).trim();
            // heurística: se ainda não temos video, é video; senão audio
            if (!video)
                video = codec;
            else if (!audio)
                audio = codec;
        }
        else if (line.startsWith('codec_type=video')) {
            // marcador, não usado aqui
        }
        else if (line.startsWith('codec_type=audio')) {
            // marcador
        }
        else if (line.startsWith('format_name=')) {
            container = line.slice('format_name='.length).trim();
        }
    }
    const compatible = (video ? VIDEO_COMPATIBLE.has(video) : true) &&
        (audio ? AUDIO_COMPATIBLE.has(audio) : true);
    return { video, audio, container, compatible };
}
//# sourceMappingURL=codec.js.map