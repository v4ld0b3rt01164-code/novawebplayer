import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'

interface VideoPlayerProps {
  src: string
  title?: string
  poster?: string
  /**
   * URL alternativa via /transcode/... (ffmpeg -> H.264/AAC).
   * Em VOD mobile ela é usada preventivamente; nos demais navegadores é
   * tentada UMA vez quando a fonte principal reporta erro real de reprodução.
   */
  fallbackSrc?: string
}

// Propriedade não-padrão exposta apenas pelo WebKit (Safari/Chrome no iOS):
// bytes de áudio decodificados até agora. Em outros engines é undefined —
// o que garante que a heurística de "toca mudo" só roda onde o problema
// (descarte silencioso de faixas AC3/EAC3) existe.
interface WebKitVideoElement extends HTMLVideoElement {
  webkitAudioDecodedByteCount?: number
}

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function VideoPlayer({ src, title, poster, fallbackSrc }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const srcRef = useRef('')
  const retryCountRef = useRef(0)
  const activeSrcRef = useRef('')
  const triedFallbackRef = useRef(false)
  const startPlaybackRef = useRef<() => void>(() => {})
  const audioProbeTimerRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const MAX_RETRIES = 5

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try { hlsRef.current.destroy() } catch {}
      hlsRef.current = null
    }
  }, [])

  const clearAudioProbe = useCallback(() => {
    if (audioProbeTimerRef.current !== null) {
      window.clearTimeout(audioProbeTimerRef.current)
      audioProbeTimerRef.current = null
    }
  }, [])

  // Troca para a URL de transcode e reinicia o playback. Retorna false se
  // não houver fallback disponível ou se ele já foi tentado nesta sessão
  // de reprodução (evita loop se o transcode também falhar).
  const tryFallback = useCallback((): boolean => {
    if (!fallbackSrc || triedFallbackRef.current) return false
    if (activeSrcRef.current === fallbackSrc) return false
    triedFallbackRef.current = true
    console.warn('[Player] fonte direta falhou; tentando transcode')
    activeSrcRef.current = fallbackSrc
    startPlaybackRef.current()
    return true
  }, [fallbackSrc])

  const startPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    destroyHls()
    clearAudioProbe()
    setError(null)
    setLoading(true)
    retryCountRef.current = 0

    let url = activeSrcRef.current || src

    // iOS Safari não suporta MSE (hls.js) e frequentemente não consegue
    // decodificar VOD não-HLS (MP4/MKV com codecs incompatíveis).
    // Android também pode rejeitar o MP4 do painel por codec/container ou
    // por uma resposta Range incompatível. Em VOD mobile, usa o pipeline
    // normalizado H.264/AAC imediatamente; Live continua HLS.
    const isIOSWebKit =
      !Hls.isSupported() &&
      typeof document !== 'undefined' &&
      !!document.createElement('video').canPlayType('application/vnd.apple.mpegurl')

    const sourcePath = url.split('?')[0]
    const sourceIsHls = sourcePath.endsWith('.m3u8')
    const preferMobileVod =
      !!fallbackSrc &&
      !sourceIsHls &&
      !sourcePath.startsWith('/transcode/') &&
      (isIOSWebKit || isMobileBrowser())

    if (preferMobileVod && fallbackSrc) {
      url = fallbackSrc
      activeSrcRef.current = fallbackSrc
      triedFallbackRef.current = true
    }

    const playVideo = () => {
      video.play().catch((reason: unknown) => {
        const errorName =
          reason && typeof reason === 'object' && 'name' in reason
            ? String((reason as { name?: unknown }).name)
            : ''
        const mediaErrorCode = video.error?.code
        const unsupported =
          errorName === 'NotSupportedError' ||
          mediaErrorCode === 3 ||
          mediaErrorCode === 4

        // Mobile Safari/Chrome can reject play() without reliably emitting
        // the media error event. Do not swallow that signal: it is the exact
        // point where the H.264/AAC fallback is needed.
        if (!unsupported) return
        if (tryFallback()) return

        setError('Formato não suportado pelo navegador.')
        setLoading(false)
      })
    }

    const cleanPath = url.split('?')[0]
    const ext = cleanPath.split('.').pop()?.toLowerCase() ?? ''
    // Apenas o fallback de LIVE responde HLS. VOD/Séries continuam MP4
    // progressivo para que o Safari não trate o conteúdo como transmissão.
    const isHls = ext === 'm3u8' || cleanPath.startsWith('/transcode/live/')

    if (!isHls) {
      video.src = url
      video.load()
      playVideo()
      return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      video.load()
      playVideo()
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
      hls.loadSource(url)
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
          } else if (tryFallback()) {
            // transcode assumiu; erro só aparece se ele também falhar
          } else {
            setError('Erro de mídia. Tente novamente.')
            setLoading(false)
          }
        } else if (tryFallback()) {
          // transcode assumiu
        } else {
          setError('Erro inesperado no player.')
          setLoading(false)
        }
      })

      video.play().catch(() => {})
    } else {
      video.src = url
      video.load()
      playVideo()
    }
  }, [src, destroyHls, clearAudioProbe, tryFallback, fallbackSrc])

  useEffect(() => {
    startPlaybackRef.current = startPlayback
  }, [startPlayback])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function onPlaying() {
      setLoading(false)
      retryCountRef.current = 0
      const v = videoRef.current
      if (v?.muted) v.muted = false

      // --- Heurística "toca mudo" (só WebKit/iOS) ---
      // Vídeo H.264 + áudio AC3/EAC3: o WebKit toca o vídeo normalmente e
      // descarta a faixa de áudio SEM disparar 'error'. Detectamos isso
      // conferindo, 3s após o playback engatar, se nenhum byte de áudio
      // foi decodificado — e então caímos para o transcode.
      const wk = videoRef.current as WebKitVideoElement | null
      if (!wk) return
      if (typeof wk.webkitAudioDecodedByteCount === 'undefined') return
      if (triedFallbackRef.current) return
      clearAudioProbe()
      const armedAt = wk.currentTime
      audioProbeTimerRef.current = window.setTimeout(() => {
        audioProbeTimerRef.current = null
        const cur = videoRef.current as WebKitVideoElement | null
        if (!cur) return
        if (cur.muted || cur.paused) return
        if (cur.currentTime <= armedAt) return
        if ((cur.webkitAudioDecodedByteCount ?? 0) > 0) return
        console.warn('[Player] reprodução sem áudio decodificado (WebKit); tentando transcode')
        tryFallback()
      }, 3000)
    }
    function onPause() { clearAudioProbe() }
    function onWaiting() { setLoading(true) }
    function onError() {
      const v = videoRef.current
      const err = v?.error
      // 3 = MEDIA_ERR_DECODE, 4 = MEDIA_ERR_SRC_NOT_SUPPORTED:
      // candidatos a incompatibilidade de codec/formato -> tentar a via
      // transcodificada antes de mostrar erro ao usuário.
      if ((err?.code === 4 || err?.code === 3) && tryFallback()) return
      if (err?.code === 4) {
        setError('Formato não suportado pelo navegador.')
      } else if (err) {
        setError(`Falha ao reproduzir (código ${err.code ?? 'desconhecido'}).`)
      }
      setLoading(false)
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('error', onError)

    if (title && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'NOVA Web Player' })
    }

    return () => {
      clearAudioProbe()
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('error', onError)
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
    }
  }, [title, tryFallback, clearAudioProbe])

  useEffect(() => {
    if (srcRef.current === src) return
    srcRef.current = src
    triedFallbackRef.current = false
    activeSrcRef.current = src
    startPlayback()
  }, [src, startPlayback])

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
          onClick={() => {
            triedFallbackRef.current = false
            activeSrcRef.current = src
            startPlayback()
          }}
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
