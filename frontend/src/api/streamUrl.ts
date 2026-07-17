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