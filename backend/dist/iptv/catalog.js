import { ApiError } from '../shared/errors.js';
const REQUEST_TIMEOUT_MS = 10_000;
function buildXtreamUrl(session, action, extra = {}) {
    const url = new URL('/player_api.php', session.server.baseUrl);
    url.searchParams.set('username', session.server.username);
    url.searchParams.set('password', session.server.password);
    url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined)
            url.searchParams.set(key, String(value));
    }
    return url;
}
async function xtreamFetch(session, action, extra) {
    const url = buildXtreamUrl(session, action, extra);
    let res;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        res = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timer);
    }
    catch {
        throw new ApiError(0, 'Falha de rede ao consultar o painel.');
    }
    if (!res.ok) {
        throw new ApiError(res.status, `Erro ${res.status} no painel`);
    }
    let payload;
    try {
        payload = await res.json();
    }
    catch {
        throw new ApiError(500, 'Resposta inválida do painel.');
    }
    return payload;
}
export async function getLiveCategories(session) {
    return xtreamFetch(session, 'get_live_categories');
}
export async function getLiveStreams(session, categoryId) {
    const extra = {};
    if (categoryId)
        extra.category_id = categoryId;
    return xtreamFetch(session, 'get_live_streams', extra);
}
export async function getShortEpg(session, streamId, limit = 4) {
    return xtreamFetch(session, 'get_short_epg', {
        stream_id: streamId,
        limit,
    });
}
export async function getVodCategories(session) {
    return xtreamFetch(session, 'get_vod_categories');
}
export async function getVodStreams(session, categoryId) {
    const extra = {};
    if (categoryId)
        extra.category_id = categoryId;
    return xtreamFetch(session, 'get_vod_streams', extra);
}
export async function getVodInfo(session, vodId) {
    return xtreamFetch(session, 'get_vod_info', {
        vod_id: vodId,
    });
}
export async function getSeriesCategories(session) {
    return xtreamFetch(session, 'get_series_categories');
}
export async function getSeries(session, categoryId) {
    const extra = {};
    if (categoryId)
        extra.category_id = categoryId;
    return xtreamFetch(session, 'get_series', extra);
}
export async function getSeriesInfo(session, seriesId) {
    const data = await xtreamFetch(session, 'get_series_info', { series_id: seriesId });
    // Alguns painéis devolvem episodes como objeto { '1': [...], '2': [...] },
    // outros como array. Normaliza para Record<string, XtreamEpisode[]>.
    const episodes = data.episodes && !Array.isArray(data.episodes)
        ? data.episodes
        : {};
    return {
        ...data,
        episodes,
    };
}
//# sourceMappingURL=catalog.js.map