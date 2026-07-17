/**
 * Proxy puro para streams IPTV — SEM ffmpeg.
 *
 * Descobre o servidor real de streaming (IP interno) via redirect do .ts,
 * depois proxya m3u8 + segmentos por lá. O Cloudflare bloqueia /hls/...
 * mas o servidor real os serve normalmente.
 */
import type { Session } from '../session/store.js';
/**
 * Erro tipado para respostas HTTP não-OK do upstream. Permite que as rotas
 * decidam se vale a pena tentar fallback (401/403) ou não (5xx, timeout).
 */
export declare class UpstreamHttpError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare function buildUpstreamUrl(session: Session, type: 'live' | 'movie' | 'series', file: string): string;
export declare function fetchRewrittenPlaylist(session: Session, type: 'live' | 'movie' | 'series', file: string, backendOrigin: string, token: string): Promise<string>;
export declare function resolveSegmentUrl(session: Session, type: 'live' | 'movie' | 'series', file: string, segment: string): Promise<string>;
export declare function fetchUpstreamSegment(upstreamUrl: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    contentType: string;
    contentLength: string;
}>;
export declare function fetchUpstreamRaw(upstreamUrl: string, rangeHeader?: string | null): Promise<{
    stream: ReadableStream<Uint8Array>;
    contentType: string;
    contentLength: string;
    status: number;
    contentRange: string | null;
}>;
//# sourceMappingURL=proxy.d.ts.map