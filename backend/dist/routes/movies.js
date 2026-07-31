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
        if (category_id) {
            const streams = await catalog.getVodStreams(req.session, category_id);
            return { streams };
        }
        const categories = await catalog.getVodCategories(req.session);
        const allStreams = [];
        const results = await Promise.allSettled(categories.map((c) => catalog.getVodStreams(req.session, c.category_id)));
        for (const r of results) {
            if (r.status === 'fulfilled')
                allStreams.push(...r.value);
        }
        return { streams: allStreams };
    });
    app.get('/:vod_id', async (req) => {
        const { vod_id } = req.params;
        return catalog.getVodInfo(req.session, Number(vod_id));
    });
};
export default movieRoutes;
export { movieRoutes };
//# sourceMappingURL=movies.js.map