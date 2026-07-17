import { sortCategories } from '../iptv/categoryOrder.js';
import * as catalog from '../iptv/catalog.js';
import { requireAuth } from './middleware.js';
const liveRoutes = async (app) => {
    app.addHook('preHandler', requireAuth);
    app.get('/categories', async (req) => {
        const categories = await catalog.getLiveCategories(req.session);
        return { categories: sortCategories(categories) };
    });
    app.get('/streams', async (req) => {
        const { category_id } = req.query;
        if (!category_id) {
            return { error: 'category_id é obrigatório' };
        }
        const streams = await catalog.getLiveStreams(req.session, category_id);
        return { streams };
    });
    app.get('/short_epg/:stream_id', async (req) => {
        const { stream_id } = req.params;
        return catalog.getShortEpg(req.session, Number(stream_id));
    });
};
export default liveRoutes;
export { liveRoutes };
//# sourceMappingURL=live.js.map