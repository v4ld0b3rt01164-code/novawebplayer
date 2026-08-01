/**
 * Proxy de imagens do catálogo upstream (logos de canais, capas de filmes,
 * backdrops de séries etc.).
 *
 * Motivo: o painel Xtream devolve URLs http:// (ex: http://img.hzplay.fun/...,
 * http://st1.coverstmdb.xyz:8080/...). Como o frontend roda em https://novawebplayer.app,
 * carregar essas URLs diretamente gera Mixed Content e o navegador bloqueia.
 * O catalog.ts reescreve essas URLs para /api/img?u=<encoded>, e esta rota
 * busca o binário upstream via http e devolve via https — mesma estratégia
 * usada para os streams.
 *
 * Não exige auth de sessão: imagens de catálogo não são sensíveis e o elemento
 * <img> não envia headers de Authorization. Há rate-limit global保护ando abuso.
 */
const imgRoutes = async (app) => {
    app.get('/img', async (req, reply) => {
        const { u } = req.query;
        if (!u)
            return reply.code(400).send({ error: 'Parâmetro "u" ausente.' });
        let target;
        try {
            target = new URL(u);
        }
        catch {
            return reply.code(400).send({ error: 'URL inválida.' });
        }
        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
            return reply.code(400).send({ error: 'Protocolo não permitido.' });
        }
        let upstream;
        try {
            upstream = await fetch(target.toString(), {
                headers: { 'User-Agent': 'NovaWebPlayer/1.0', Accept: 'image/*,*/*' },
                signal: AbortSignal.timeout(10_000),
                redirect: 'follow',
            });
        }
        catch {
            return reply.code(502).send({ error: 'Falha ao buscar imagem upstream.' });
        }
        if (!upstream.ok) {
            return reply.code(502).send({ error: `Upstream ${upstream.status}.` });
        }
        const contentType = upstream.headers.get('content-type') ?? 'image/*';
        const contentLength = upstream.headers.get('content-length');
        reply.header('content-type', contentType);
        reply.header('cache-control', 'public, max-age=86400');
        if (contentLength)
            reply.header('content-length', contentLength);
        return reply.send(upstream.body);
    });
};
export default imgRoutes;
export { imgRoutes };
//# sourceMappingURL=img.js.map