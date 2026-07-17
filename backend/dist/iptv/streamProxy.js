import { Readable } from 'node:stream';
import { ApiError } from '../shared/errors.js';
function webStreamToNode(stream) {
    const reader = stream.getReader();
    return new Readable({
        read() {
            reader
                .read()
                .then(({ done, value }) => {
                if (done) {
                    this.push(null);
                }
                else {
                    this.push(Buffer.from(value));
                }
            })
                .catch((err) => {
                this.destroy(err);
            });
        },
    });
}
const UPSTREAM_TIMEOUT_MS = 30_000;
function buildUpstreamUrl(session, type, relativePath) {
    const { baseUrl, username, password } = session.server;
    const basePath = type === 'live' ? 'live' : type;
    return new URL(`/${basePath}/${username}/${password}/${relativePath}`, baseUrl);
}
/**
 * Define o Content-Type correto com base na extensão do arquivo.
 *
 * O upstream do painel IPTV frequentemente devolve `application/octet-stream`
 * ou outros tipos genéricos. O navegador recusa tocar `<video>` se o MIME
 * não bate com o formato real, então forçamos o tipo correto aqui.
 */
function contentTypeFor(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.m3u8'))
        return 'application/vnd.apple.mpegurl';
    if (lower.endsWith('.ts'))
        return 'video/mp2t';
    if (lower.endsWith('.mp4'))
        return 'video/mp4';
    if (lower.endsWith('.m4s'))
        return 'video/iso.segment';
    if (lower.endsWith('.webm'))
        return 'video/webm';
    if (lower.endsWith('.mkv'))
        return 'video/x-matroska';
    if (lower.endsWith('.aac'))
        return 'audio/aac';
    if (lower.endsWith('.mp3'))
        return 'audio/mpeg';
    return 'application/octet-stream';
}
/**
 * Proxy de streams de vídeo.
 *
 * Repassa a requisição para o painel ativo da sessão, preservando headers
 * importantes (Range, Accept-Ranges, Content-Length). Para playlists .m3u8,
 * reescreve URLs absolutas do painel para URLs do nosso proxy, garantindo
 * que segmentos .ts continuem passando pelo backend.
 */
export async function proxyStream(session, type, relativePath, req, reply) {
    const upstreamUrl = buildUpstreamUrl(session, type, relativePath);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let upstreamRes;
    try {
        upstreamRes = await fetch(upstreamUrl.toString(), {
            method: req.method,
            signal: controller.signal,
            headers: req.headers.range ? { range: req.headers.range } : undefined,
        });
    }
    catch {
        throw new ApiError(0, 'Falha de rede ao proxyar stream.');
    }
    finally {
        clearTimeout(timer);
    }
    reply.status(upstreamRes.status);
    upstreamRes.headers.forEach((value, name) => {
        const lower = name.toLowerCase();
        if (lower === 'content-encoding' ||
            lower === 'transfer-encoding' ||
            lower === 'connection' ||
            lower === 'keep-alive' ||
            lower === 'content-type') {
            return;
        }
        void reply.header(name, value);
    });
    // Sempre força o Content-Type com base na extensão (o upstream mente)
    void reply.header('content-type', contentTypeFor(relativePath));
    if (!upstreamRes.body) {
        return reply.send('');
    }
    const lower = relativePath.toLowerCase();
    const isPlaylist = lower.endsWith('.m3u8');
    if (isPlaylist) {
        const text = await upstreamRes.text();
        const basePath = type === 'live' ? 'live' : type;
        const origin = `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers.host}`;
        const tokenQuery = `token=${session.token}`;
        let rewritten = text
            // 1) URLs absolutas do painel → /stream/raw/<resto>?token=...
            .replaceAll(session.server.baseUrl, `${origin}/stream/raw`)
            // 2) Caminhos do estilo /live/user/pass/... → /stream/live/<resto>?token=...
            .replaceAll(`/${basePath}/${session.server.username}/${session.server.password}/`, `/stream/${basePath}/`)
            // 3) Caminhos absolutos /hls/... → /stream/raw/hls/...
            .replace(/(^|\s)\/hls\//g, `$1${origin}/stream/raw/hls/`);
        // 4) Anexa ?token=... em todas as URLs de segmento (.ts, .m3u8, .m4s, .mp4)
        //    que ainda não tenham query string. Necessário porque o <video>
        //    nativo e o hls.js disparam as requisições dos segmentos sem
        //    Authorization header.
        rewritten = rewritten.replace(/^(\s*)(\S+\.(?:ts|m3u8|m4s|mp4|m4a|aac))(\s*)$/gim, (_m, lead, url, trail) => {
            const sep = url.includes('?') ? '&' : '?';
            return `${lead}${url}${sep}${tokenQuery}${trail}`;
        });
        return reply.send(rewritten);
    }
    const nodeStream = webStreamToNode(upstreamRes.body);
    return reply.send(nodeStream);
}
//# sourceMappingURL=streamProxy.js.map