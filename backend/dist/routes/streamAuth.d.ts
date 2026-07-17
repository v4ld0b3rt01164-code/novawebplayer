import type { FastifyReply, FastifyRequest } from 'fastify';
/**
 * Autenticação para rotas de stream/transcode.
 *
 * Aceita token via header `Authorization: Bearer <token>` OU via query
 * string `?token=<token>`. Isso é necessário porque o elemento `<video>`
 * nativo do Safari/iOS e o `<video src>` em geral não permitem anexar
 * headers customizados às requisições que disparam para buscar o .m3u8 e
 * os segmentos .ts.
 */
export declare function requireStreamAuth(req: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=streamAuth.d.ts.map