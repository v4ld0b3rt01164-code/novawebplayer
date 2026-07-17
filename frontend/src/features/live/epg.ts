import type { EpgData, EpgProgramme } from '../../types/index.js'

export function findNowNext(programmes: EpgProgramme[]) {
  const now = Date.now()
  const index = programmes.findIndex(
    (p) => p.start_timestamp <= now && p.stop_timestamp > now,
  )
  return {
    now: index >= 0 ? programmes[index] : null,
    next: index >= 0 ? programmes[index + 1] ?? null : null,
  }
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getChannelEpg(
  epgData: EpgData | undefined,
  epgChannelId: string | null | undefined,
): { name: string; programmes: EpgProgramme[] } | null {
  if (!epgChannelId || !epgData) return null
  return epgData.channels[epgChannelId] ?? null
}
