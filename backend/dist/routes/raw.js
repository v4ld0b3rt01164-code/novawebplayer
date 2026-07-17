import { Readable } from 'node:stream';
import { ApiError } from '../shared/errors.js';
import { requireStreamAuth } from './streamAuth.js';
function webStreamToNode(stream) {
    const reader = stream.getReader();
    return new Readable({
        read() {
            reader
                .read()
                .then(({ done, value }) => {
                if (done)
                    this.push(null);
                else
                    this.push(Buffer.from(value));
            })
                .catch((err) => this.destroy(err));
        },
    });
}
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
const rawRoutes = async (app) => {
    app.addHook('preHandler', requireStreamAuth);
    // /stream/raw/* → proxy genérico para ${baseUrl}/*
    app.get('/raw/*', async (req, reply) => {
        const wildcard = req.params['*'];
        if (!wildcard) {
            return reply.status(400).send({ error: 'Caminho ausente.' });
        }
        const session = req.session;
        const upstreamUrl = new URL(wildcard, session.server.baseUrl).toString();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        let upstreamRes;
        try {
            upstreamRes = await fetch(upstreamUrl, {
                method: req.method,
                signal: controller.signal,
                headers: req.headers.range ? { range: req.headers.range } : undefined,
            });
        }
        catch {
            throw new ApiError(0, 'Falha ao buscar recurso upstream.');
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
        void reply.header('content-type', contentTypeFor(wildcard));
        if (!upstreamRes.body) {
            return reply.send('');
        }
        if (wildcard.toLowerCase().endsWith('.m3u8')) {
            const text = await upstreamRes.text();
            const origin = `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers.host}`;
            const tokenQuery = `token=${session.token}`;
            let rewritten = text
                .replaceAll(session.server.baseUrl, `${origin}/stream/raw`)
                // Caminhos absolutos /hls/... → /stream/raw/hls/...
                .replace(/(^|\s)\/hls\//g, `$1${origin}/stream/raw/hls/`);
            // Anexa token nas URLs de segmento
            rewritten = rewritten.replace(/^(\s*)(\S+\.(?:ts|m3u8|m4s|mp4|m4a|aac))(\s*)$/gim, (_m, lead, url, trail) => {
                const sep = url.includes('?') ? '&' : '?';
                return `${lead}${url}${sep}${tokenQuery}${trail}`;
            });
            return reply.send(rewritten);
        }
        return reply.send(webStreamToNode(upstreamRes.body));
    });
};
export default rawRoutes;
export { rawRoutes };
//# sourceMappingURL=raw.js.map