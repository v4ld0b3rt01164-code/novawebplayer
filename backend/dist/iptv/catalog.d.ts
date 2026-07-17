import type { Session } from '../session/store.js';
import { type XtreamCategory, type XtreamLiveStream, type XtreamSeries, type XtreamSeriesInfoResponse, type XtreamShortEpgResponse, type XtreamVodInfoResponse, type XtreamVodStream } from './types.js';
export declare function getLiveCategories(session: Session): Promise<XtreamCategory[]>;
export declare function getLiveStreams(session: Session, categoryId: string): Promise<XtreamLiveStream[]>;
export declare function getShortEpg(session: Session, streamId: number, limit?: number): Promise<XtreamShortEpgResponse>;
export declare function getVodCategories(session: Session): Promise<XtreamCategory[]>;
export declare function getVodStreams(session: Session, categoryId?: string): Promise<XtreamVodStream[]>;
export declare function getVodInfo(session: Session, vodId: number): Promise<XtreamVodInfoResponse>;
export declare function getSeriesCategories(session: Session): Promise<XtreamCategory[]>;
export declare function getSeries(session: Session, categoryId?: string): Promise<XtreamSeries[]>;
export declare function getSeriesInfo(session: Session, seriesId: number): Promise<XtreamSeriesInfoResponse>;
//# sourceMappingURL=catalog.d.ts.map