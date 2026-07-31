/**
 * Helper para gerar URLs de stream com token na query string.
 *
 * O backend valida o token via query string (além do Authorization header)
 * porque o elemento <video> nativo do Safari/iOS e o hls.js, ao buscarem
 * o .m3u8 e os segmentos .ts internamente, não enviam headers customizados.
 * Colocar o token na URL é a única forma universal de autenticar essas
 * requisições.
 */

export function liveStreamUrl(streamId: number, token: string): string {
  return `/stream/live/${streamId}.m3u8?token=${encodeURIComponent(token)}`
}

export function movieStreamUrl(
  streamId: number,
  ext: string,
  token: string,
): string {
  return `/stream/movie/${streamId}.${ext || 'mp4'}?token=${encodeURIComponent(token)}`
}

export function seriesStreamUrl(
  episodeId: string,
  ext: string,
  token: string,
): string {
  return `/stream/series/${episodeId}.${ext || 'mp4'}?token=${encodeURIComponent(token)}`
}

/**
 * URLs de fallback via /transcode/... (pipeline ffmpeg do backend).
 *
 * Usadas pelo VideoPlayer quando o navegador reporta erro real de
 * reprodução na URL /stream/... (ex.: áudio AC3/EAC3 no iOS, MP4 sem
 * faststart). Mesmo padrão de path e token das funções acima.
 *
 * LIVE retorna HLS H.264/AAC. MOVIES/SERIES retornam MP4 progressivo
 * H.264/AAC, preservando a semântica de VOD no Safari/iOS.
 */

export function liveTranscodeUrl(streamId: number, token: string): string {
  return `/transcode/live/${streamId}.m3u8?token=${encodeURIComponent(token)}`
}

export function movieTranscodeUrl(
  streamId: number,
  ext: string,
  token: string,
): string {
  return `/transcode/movie/${streamId}.${ext || 'mp4'}?token=${encodeURIComponent(token)}`
}

export function seriesTranscodeUrl(
  episodeId: string,
  ext: string,
  token: string,
): string {
  return `/transcode/series/${episodeId}.${ext || 'mp4'}?token=${encodeURIComponent(token)}`
}
