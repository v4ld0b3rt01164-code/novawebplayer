import type { Session } from '../session/store.js';
export interface EpgProgramme {
    title: string;
    description: string;
    start: string;
    stop: string;
    start_timestamp: number;
    stop_timestamp: number;
}
export interface EpgChannel {
    name: string;
    programmes: EpgProgramme[];
}
export interface EpgData {
    generatedAt: number;
    channels: Record<string, EpgChannel>;
}
/**
 * Retorna o EPG parseado, usando cache em memória de 30 min.
 * Em caso de falha, retorna o cache anterior se ainda houver.
 */
export declare function getFullEpg(session: Session): Promise<EpgData>;
export declare function getChannelEpg(session: Session, epgChannelId: string | null | undefined): Promise<EpgChannel | null>;
export declare function findNowNext(programmes: EpgProgramme[]): {
    now: EpgProgramme | null;
    next: EpgProgramme | null;
};
//# sourceMappingURL=epg.d.ts.map