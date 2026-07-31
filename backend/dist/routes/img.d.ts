import type { FastifyPluginAsync } from 'fastify';
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
declare const imgRoutes: FastifyPluginAsync;
export default imgRoutes;
export { imgRoutes };
//# sourceMappingURL=img.d.ts.map