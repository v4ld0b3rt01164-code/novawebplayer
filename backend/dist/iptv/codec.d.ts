import type { Session } from '../session/store.js';
export interface StreamCodec {
    video: string | null;
    audio: string | null;
    container: string | null;
    compatible: boolean;
}
export declare function probeStream(session: Session, type: 'live' | 'movie' | 'series', relativePath: string): Promise<StreamCodec>;
//# sourceMappingURL=codec.d.ts.map