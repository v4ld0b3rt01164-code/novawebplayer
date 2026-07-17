import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { requireStreamAuth } from './streamAuth.js';
import { getDir, playlistPath, readSegmentStream, segmentPath, segmentStat, startTranscode, touch, waitForFirstSeg, } from '../iptv/transcode.js';
const transcodeRoutes = async (app) => {
    app.addHook('preHandler', requireStreamAuth);
    // /transcode/live/<stream_id>.m3u8
    // /transcode/movie/<stream_id>.<ext>
    // /transcode/series/<stream_id>.<ext>
    app.get('/:type/:file', async (req, reply) => {
        const { type, file } = req.params;
        if (!['live', 'movie', 'series'].includes(type)) {
            return reply.status(400).send({ error: 'Tipo inválido.' });
        }
        const session = req.session;
        const dir = await startTranscode(session, type, file);
        const ready = await waitForFirstSeg(dir, 25_000);
        if (!ready) {
            return reply.status(504).send({
                error: 'Tempo esgotado aguardando geração do HLS.',
            });
        }
        touch(session, type, file);
        // Reescreve o m3u8 gerado pelo ffmpeg para que cada segmento aponte
        // para uma URL absoluta do nosso backend com ?token=...
        const playlist = playlistPath(dir);
        const raw = await readFile(playlist, 'utf-8');
        const origin = `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers.host}`;
        const tokenQuery = `token=${session.token}`;
        const rewritten = raw.replace(/^(\s*)(\S+\.(?:ts|m3u8|m4s|mp4|m4a|aac))(\s*)$/gim, (_m, lead, url, trail) => {
            const sep = url.includes('?') ? '&' : '?';
            return `${lead}${origin}/transcode/seg/${type}/${file}/${url}${sep}${tokenQuery}${trail}`;
        });
        void reply.header('content-type', 'application/vnd.apple.mpegurl');
        void reply.header('cache-control', 'no-store');
        return reply.send(rewritten);
    });
    // /transcode/seg/<type>/<file>/<segment>
    app.get('/seg/:type/:file/:segment', async (req, reply) => {
        const { type, file, segment } = req.params;
        if (!['live', 'movie', 'series'].includes(type)) {
            return reply.status(400).send({ error: 'Tipo inválido.' });
        }
        const session = req.session;
        touch(session, type, file);
        const dir = getDir(session, type, file);
        const p = segmentPath(dir, segment);
        if (!existsSync(p)) {
            return reply.status(404).send({ error: 'Segmento não encontrado.' });
        }
        const stat = segmentStat(dir, segment);
        if (!stat) {
            return reply.status(404).send({ error: 'Segmento não encontrado.' });
        }
        void reply.header('content-type', 'video/mp2t');
        void reply.header('content-length', String(stat.size));
        void reply.header('cache-control', 'no-store');
        return reply.send(readSegmentStream(dir, segment));
    });
};
export default transcodeRoutes;
export { transcodeRoutes };
//# sourceMappingURL=transcode.js.map