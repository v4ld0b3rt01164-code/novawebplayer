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
        const series = await catalog.getSeries(req.session, category_id);
        return { series };
    });
    app.get('/:series_id', async (req) => {
        const { series_id } = req.params;
        return catalog.getSeriesInfo(req.session, Number(series_id));
    });
};
export default seriesRoutes;
export { seriesRoutes };
//# sourceMappingURL=series.js.map