import * as catalog from '../iptv/catalog.js';
import { sortCategories } from '../iptv/categoryOrder.js';
import { requireAuth } from './middleware.js';
const seriesRoutes = async (app) => {
    app.addHook('preHandler', requireAuth);
    app.get('/categories', async (req) => {
        const categories = await catalog.getSeriesCategories(req.session);
        return { categories: sortCategories(categories) };
    });
    app.get('/', async (req) => {
        const { category_id } = req.query;
        if (category_id) {
            const series = await catalog.getSeries(req.session, category_id);
            return { series };
        }
        const categories = await catalog.getSeriesCategories(req.session);
        const allSeries = [];
        const results = await Promise.allSettled(categories.map((c) => catalog.getSeries(req.session, c.category_id)));
        for (const r of results) {
            if (r.status === 'fulfilled')
                allSeries.push(...r.value);
        }
        return { series: allSeries };
    });
    app.get('/:series_id', async (req) => {
        const { series_id } = req.params;
        return catalog.getSeriesInfo(req.session, Number(series_id));
    });
};
export default seriesRoutes;
export { seriesRoutes };
//# sourceMappingURL=series.js.map