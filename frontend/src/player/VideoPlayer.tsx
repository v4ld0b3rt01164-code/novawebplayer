import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'

interface VideoPlayerProps {
  src: string
  title?: string
  poster?: string
  /**
   * URL alternativa via /transcode/... (ffmpeg -> H.264/AAC).
   * Tentada UMA vez quando a fonte principal reporta erro real de reprodução.
   */
  fallbackSrc?: string
  /**
   * Callback opcional disparado quando o elemento <video> fica disponível.
   * Usado apenas para acionar webkitEnterFullscreen() no iOS; em Android e
   * desktop a prop e ignorada. O callback pode receber `null` ao desmontar.
   */
  onVideoElement?: (el: HTMLVideoElement | null) => void
}

// Propriedade não-padrão exposta apenas pelo WebKit (Safari/Chrome no iOS):
// bytes de áudio decodificados até agora. Em outros engines é undefined —
// o que garante que a heurística de "toca mudo" só roda onde o problema
// (descarte silencioso de faixas AC3/EAC3) existe.
interface WebKitVideoElement extends HTMLVideoElement {
  webkitAudioDecodedByteCount?: number
}

function detectIosWebKit(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isApple = /iPhone|iPad|iPod/i.test(ua)
  if (!isApple) return false
  // Chrome no iOS usa o motor do Safari (WebKit), entao o mesmo fallback se aplica.
  return /WebKit| CriOS/i.test(ua)
}

export function VideoPlayer({ src, title, poster, fallbackSrc, onVideoElement }: VideoPlayerProps) {
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
  // de reprodução (evita loop se o transcode também falhar). Para VOD,
  // o transcode é usado apenas no iOS (Safari/Chrome iOS), que não
  // consegue decodificar alguns codecs (HEVC, AC3, MKV). Android e desktop
  // seguem no MP4 direto, que é confiável.
  const tryFallback = useCallback((): boolean => {
    if (!fallbackSrc || triedFallbackRef.current) return false
    if (activeSrcRef.current === fallbackSrc) return false
    const cleanPath = (activeSrcRef.current || src).split('?')[0]
    const isHls = cleanPath.endsWith('.m3u8') || cleanPath.startsWith('/transcode/live/')
    if (!isHls && !detectIosWebKit()) return false
    triedFallbackRef.current = true
    console.warn('[Player] fonte direta falhou; tentando transcode')
    activeSrcRef.current = fallbackSrc
    startPlaybackRef.current()
    return true
  }, [fallbackSrc, src])

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

    // Regra de seleção do pipeline HLS (ver AGENTS.md §Stack):
    //   "Safari/iOS não deve usar hls.js — usar reprodução nativa lá"
    // - iOS (qualquer browser): HLS nativo (todos os browsers iOS são
    //   WebKit/Safari por baixo dos panos; mesmo iOS Chrome/Firefox usam
    //   o engine HLS do sistema, que é mais permissivo que o do Chrome
    //   desktop e lida bem com AC3/EAC3). É o que o iOS WebKit redirect
    //   acima e a heurística "toca mudo" (webkitAudioDecodedByteCount)
    //   assumem.
    // - Safari macOS: HLS nativo também (engine mais completo que hls.js).
    // - Demais (Chrome desktop, Firefox, Edge): hls.js. Razão: o HLS
    //   nativo do Chrome desktop é estrito com codecs — streams com
    //   áudio AC3/EAC3 (comum em IPTV BR, ex.: A&E SD) fazem o
    //   <video> abortar com MEDIA_ERR_SRC_NOT_SUPPORTED em poucos
    //   segundos. hls.js é tolerante e toca o vídeo mesmo sem
    //   decodificar o áudio incompatível.
    const ua = navigator.userAgent
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
    const isIOS = /iP(hone|ad|od)/.test(ua)
    const useNativeHls =
      (isSafari || isIOS) && !!video.canPlayType('application/vnd.apple.mpegurl')

    if (useNativeHls) {
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

  // Expoe o <video> para consumidores que precisem acionar fullscreen nativo
  // (iOS). No-op quando onVideoElement nao e fornecido; em Android/desktop a
  // logica de fullscreen e responsabilidade do consumidor (no-op em outros
  // navegadores via detectIosWebKit).
  useEffect(() => {
    if (!onVideoElement) return
    onVideoElement(videoRef.current)
    return () => {
      onVideoElement(null)
    }
  }, [onVideoElement])

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
