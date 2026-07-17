import * as catalog from '../iptv/catalog.js';
import { sortCategories } from '../iptv/categoryOrder.js';
import { requireAuth } from './middleware.js';
const movieRoutes = async (app) => {
    app.addHook('preHandler', requireAuth);
    app.get('/categories', async (req) => {
        const categories = await catalog.getVodCategories(req.session);
        return { categories: sortCategories(categories) };
    });
    app.get('/streams', async (req) => {
        const { category_id } = req.query;
        const streams = await catalog.getVodStreams(req.session, category_id);
        return { streams };
    });
    app.get('/:vod_id', async (req) => {
        const { vod_id } = req.params;
        return catalog.getVodInfo(req.session, Number(vod_id));
    });
};
export default movieRoutes;
export { movieRoutes };
//# sourceMappingURL=movies.js.map