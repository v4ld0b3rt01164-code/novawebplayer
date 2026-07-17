import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Session } from '../session/store.js';
/**
 * Proxy de streams de vídeo.
 *
 * Repassa a requisição para o painel ativo da sessão, preservando headers
 * importantes (Range, Accept-Ranges, Content-Length). Para playlists .m3u8,
 * reescreve URLs absolutas do painel para URLs do nosso proxy, garantindo
 * que segmentos .ts continuem passando pelo backend.
 */
export declare function proxyStream(session: Session, type: 'live' | 'movie' | 'series', relativePath: string, req: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=streamProxy.d.ts.map