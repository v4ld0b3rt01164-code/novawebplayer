import { requireStreamAuth } from './streamAuth.js';
/** Mascarar senha em URL upstream para logs seguros. */
function maskUrl(url) {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/');
        // parts: ['', type, username, password, ...file]
        if (parts.length >= 5) {
            parts[4] = '****';
        }
        parsed.pathname = parts.join('/');
        return parsed.toString();
    }
    catch {
        return url;
    }
}
import { fetchRewrittenPlaylist, fetchUpstreamSegment, fetchUpstreamRaw, resolveSegmentUrl, buildUpstreamUrl, } from '../iptv/proxy.js';
import { withUpstreamFallback } from '../iptv/withFallback.js';
const streamRoutes = async (app) => {
    app.addHook('preHandler', requireStreamAuth);
    app.options('/:type/:file', async (_req, reply) => {
        // CORS headers handled centrally by onSend hook in index.ts
        return reply.code(204).send();
    });
    app.get('/:type/:file', async (req, reply) => {
        const { type, file } = req.params;
        if (!['live', 'movie', 'series'].includes(type)) {
            return reply.status(400).send({ error: 'Tipo inválido.' });
        }
        const session = req.session;
        const ext = file.split('.').pop()?.toLowerCase() ?? '';
        if (ext === 'm3u8') {
            const origin = `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers.host}`;
            try {
                const playlist = await withUpstreamFallback(session, () => fetchRewrittenPlaylist(session, type, file, origin, session.token));
                reply.header('content-type', 'application/vnd.apple.mpegurl');
                reply.header('cache-control', 'no-store');
                return reply.send(playlist);
            }
            catch (err) {
                console.error(`[stream] erro ao buscar ${type}/${file}:`, err.message);
                return reply.status(502).send({ error: 'Falha ao buscar stream upstream.' });
            }
        }
        try {
            const rangeHeader = req.headers.range;
            const { stream, contentType, contentLength, status, contentRange } = await withUpstreamFallback(session, () => {
                const upstreamUrl = buildUpstreamUrl(session, type, file);
                return fetchUpstreamRaw(upstreamUrl, rangeHeader);
            });
            reply.header('content-type', contentType);
            reply.header('accept-ranges', 'bytes');
            if (contentRange) {
                reply.header('content-range', contentRange);
            }
            if (contentLength !== '0') {
                reply.header('content-length', contentLength);
            }
            reply.header('cache-control', 'no-store');
            return reply.status(status).send(stream);
        }
        catch (err) {
            console.error(`[stream] erro ao buscar ${type}/${file}:`, err.message);
            return reply.status(502).send({ error: 'Falha ao buscar stream upstream.' });
        }
    });
    app.get('/seg/:type/:file/:segment', async (req, reply) => {
        const { type, file, segment } = req.params;
        if (!['live', 'movie', 'series'].includes(type)) {
            return reply.status(400).send({ error: 'Tipo inválido.' });
        }
        const session = req.session;
        let lastAttemptedUrl = '';
        try {
            const { stream, contentType, contentLength } = await withUpstreamFallback(session, async () => {
                lastAttemptedUrl = await resolveSegmentUrl(session, type, file, segment);
                return fetchUpstreamSegment(lastAttemptedUrl);
            });
            reply.header('content-type', contentType);
            if (contentLength !== '0') {
                reply.header('content-length', contentLength);
            }
            reply.header('cache-control', 'no-store');
            return reply.send(stream);
        }
        catch (err) {
            console.error(`[stream] erro ao buscar segmento: ${err.message} | url: ${maskUrl(lastAttemptedUrl)}`);
            return reply.status(502).send({ error: 'Falha ao buscar segmento.' });
        }
    });
};
export default streamRoutes;
export { streamRoutes };
//# sourceMappingURL=stream.js.map