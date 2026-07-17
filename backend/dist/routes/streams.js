import { proxyStream } from '../iptv/streamProxy.js';
import { requireStreamAuth } from './streamAuth.js';
const streamRoutes = async (app) => {
    app.addHook('preHandler', requireStreamAuth);
    // Live: playlist .m3u8 e segmentos .ts (ou outros) passam pela mesma rota
    app.get('/live/:file', async (req, reply) => {
        const { file } = req.params;
        return proxyStream(req.session, 'live', file, req, reply);
    });
    app.get('/movie/:id.:ext', async (req, reply) => {
        const { id, ext } = req.params;
        return proxyStream(req.session, 'movie', `${id}.${ext}`, req, reply);
    });
    app.get('/series/:id.:ext', async (req, reply) => {
        const { id, ext } = req.params;
        return proxyStream(req.session, 'series', `${id}.${ext}`, req, reply);
    });
};
export default streamRoutes;
export { streamRoutes };
//# sourceMappingURL=streams.js.map