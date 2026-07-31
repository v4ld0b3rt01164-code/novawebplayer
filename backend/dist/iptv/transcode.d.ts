/**
 * Pipeline de vídeo baseado em ffmpeg.
 *
 * Para LIVE: faz download completo do .m3u8 upstream (que tem segmentos
 * protegidos por sessão do painel) e gera HLS local com -c copy
 * (sem re-encoding, rápido).
 *
 * Para MOVIE/SERIES: baixa o arquivo upstream e gera MP4 local com
 * transcodificacao para H.264/AAC (resolve codec incompatível).
 *
 * O frontend consome sempre /transcode/<type>/<file>?token=<uuid> e
 * recebe HLS apenas para LIVE e MP4 progressivo para VOD.
 */
import type { Session } from '../session/store.js';
/**
 * Inicia (ou reutiliza) o pipeline ffmpeg para o stream.
 * Retorna o diretório onde o resultado transcodificado é gerado.
 */
export declare function startTranscode(session: Session, type: 'live' | 'movie' | 'series', file: string): Promise<string>;
export declare function touch(session: Session, type: string, file: string): void;
export declare function getDir(session: Session, type: 'live' | 'movie' | 'series', file: string): string;
export declare function playlistPath(dir: string): string;
export declare function vodPath(dir: string): string;
export declare function vodStat(dir: string): import("fs").Stats | null;
export declare function readVodStream(dir: string, start?: number, end?: number): import("fs").ReadStream;
export declare function segmentPath(dir: string, segment: string): string;
export declare function readPlaylistStream(dir: string): import("fs").ReadStream;
export declare function readSegmentStream(dir: string, segment: string): import("fs").ReadStream;
export declare function segmentStat(dir: string, segment: string): import("fs").Stats | null;
export declare function waitForFirstSeg(dir: string, timeoutMs?: number): Promise<boolean>;
export declare function waitForVodTranscode(session: Session, type: 'movie' | 'series', file: string, timeoutMs?: number): Promise<boolean>;
//# sourceMappingURL=transcode.d.ts.map