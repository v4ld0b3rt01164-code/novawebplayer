import { getSession } from '../session/store.js';
function extractToken(req) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7);
    // Streams são carregados por <video>/hls.js, que não enviam headers
    // customizados (especialmente o Safari/iOS). Aceitamos o token via query
    // string apenas nestas rotas — o token continua sendo um UUID opaco,
    // equivalente em segurança ao Authorization: Bearer.
    const query = req.query;
    return query?.token;
}
/**
 * Autenticação para rotas de stream/transcode.
 *
 * Aceita token via header `Authorization: Bearer <token>` OU via query
 * string `?token=<token>`. Isso é necessário porque o elemento `<video>`
 * nativo do Safari/iOS e o `<video src>` em geral não permitem anexar
 * headers customizados às requisições que disparam para buscar o .m3u8 e
 * os segmentos .ts.
 */
export async function requireStreamAuth(req, reply) {
    const token = extractToken(req);
    const session = getSession(token);
    if (!session) {
        return reply.status(401).send({ error: 'Sessão inválida ou expirada.' });
    }
    req.session = session;
}
//# sourceMappingURL=streamAuth.js.map