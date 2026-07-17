import { useEffect, useRef } from 'react'

interface Mp4PlayerProps {
  src: string
  title?: string
  poster?: string
  autoPlay?: boolean
}

export function Mp4Player({ src, title, poster, autoPlay = true }: Mp4PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    if (autoPlay) video.play().catch(() => {})

    if (title && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'NOVA Web Player',
      })
    }
    return () => {
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
    }
  }, [title, autoPlay])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      playsInline
      controls
      muted
      autoPlay
      className="h-full w-full bg-black"
    />
  )
}
