import { useEffect, useRef } from 'react'
import type HlsType from 'hls.js'

interface HlsPlayerProps {
  src: string
  title?: string
  poster?: string
  autoPlay?: boolean
}

export function HlsPlayer({ src, title, poster, autoPlay = true }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // iOS exige muted + playsInline para autoplay
    video.muted = true
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      if (autoPlay) video.play().catch(() => {})

      if (title && 'mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist: 'NOVA Web Player',
        })
      }

      return () => {
        video.src = ''
        if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
      }
    }

    let hls: HlsType | null = null
    let destroyed = false

    import('hls.js')
      .then((mod) => {
        const HlsConstructor = (mod as unknown as { default: typeof HlsType })
          .default
        if (!HlsConstructor.isSupported() || destroyed) return

        hls = new HlsConstructor({
          enableWorker: true,
          lowLatencyMode: true,
        })
        hls.loadSource(src)
        hls.attachMedia(video)
        if (autoPlay) video.play().catch(() => {})
      })
      .catch(() => {})

    if (title && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'NOVA Web Player',
      })
    }

    return () => {
      destroyed = true
      if (hls) {
        hls.destroy()
        hls = null
      }
      video.src = ''
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
    }
  }, [src, title, autoPlay])

  return (
    <video
      ref={videoRef}
      poster={poster}
      playsInline
      controls
      muted
      autoPlay
      className="h-full w-full bg-black"
    />
  )
}
