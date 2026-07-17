import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'

interface VideoPlayerProps {
  src: string
  title?: string
  poster?: string
}

export function VideoPlayer({ src, title, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const srcRef = useRef('')
  const retryCountRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const MAX_RETRIES = 5

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try { hlsRef.current.destroy() } catch {}
      hlsRef.current = null
    }
  }, [])

  const startPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    destroyHls()
    setError(null)
    setLoading(true)
    retryCountRef.current = 0

    const ext = src.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    const isHls = ext === 'm3u8'

    if (!isHls) {
      video.src = src
      video.play().catch(() => {})
      return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.play().catch(() => {})
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveDurationInfinity: true,
        startFragPrefetch: true,
        testBandwidth: false,
      })
      hls.loadSource(src)
      hls.attachMedia(video)
      hlsRef.current = hls

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++
            console.warn(`[Player] retry de rede #${retryCountRef.current}`)
            setTimeout(() => {
              try { hls.startLoad() } catch {}
            }, 1000 * retryCountRef.current)
          } else {
            setError('Conexão perdida. Tente novamente.')
            setLoading(false)
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++
            console.warn(`[Player] retry de mídia #${retryCountRef.current}`)
            try { hls.recoverMediaError() } catch {}
          } else {
            setError('Erro de mídia. Tente novamente.')
            setLoading(false)
          }
        } else {
          setError('Erro inesperado no player.')
          setLoading(false)
        }
      })

      video.play().catch(() => {})
    } else {
      video.src = src
      video.play().catch(() => {})
    }
  }, [src, destroyHls])

  useEffect(() => {
    if (srcRef.current === src) return
    srcRef.current = src
    startPlayback()
  }, [src, startPlayback])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function onPlaying() {
      setLoading(false)
      retryCountRef.current = 0
      const v = videoRef.current
      if (v?.muted) v.muted = false
    }
    function onWaiting() { setLoading(true) }
    function onError() {
      const v = videoRef.current
      const err = v?.error
      if (err?.code === 4) {
        setError('Formato não suportado pelo navegador.')
      } else if (err) {
        setError(`Falha ao reproduzir (código ${err.code ?? 'desconhecido'}).`)
      }
      setLoading(false)
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('error', onError)

    if (title && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'NOVA Web Player' })
    }

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('error', onError)
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
    }
  }, [title])

  useEffect(() => {
    return () => destroyHls()
  }, [destroyHls])

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black p-6 text-center text-sm text-zinc-300">
        <p className="text-base font-semibold text-red-300">
          Não foi possível reproduzir
        </p>
        <p className="max-w-md text-zinc-400">{error}</p>
        <button
          type="button"
          onClick={() => { srcRef.current = ''; startPlayback() }}
          className="rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-lg active:scale-[0.98]"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        controls
        muted
        autoPlay
        className="h-full w-full"
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-accent" />
        </div>
      )}
    </div>
  )
}
