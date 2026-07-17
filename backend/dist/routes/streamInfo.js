import { probeStream } from '../iptv/codec.js';
import { requireAuth } from './middleware.js';
const streamInfoRoutes = async (app) => {
    app.addHook('preHandler', requireAuth);
    app.get('/codec/:type/*', async (req, reply) => {
        const { type } = req.params;
        // Captura o caminho relativo (ex: "123.mp4" ou "123.m3u8")
        const wildcard = req.params['*'];
        if (!wildcard) {
            return reply.status(400).send({ error: 'Caminho do stream ausente.' });
        }
        const probe = await probeStream(req.session, type, wildcard);
        return probe;
    });
};
export default streamInfoRoutes;
export { streamInfoRoutes };
//# sourceMappingURL=streamInfo.js.map