import { useCallback, useEffect, useState } from 'react'

type FavoriteType = 'live' | 'movies' | 'series'

interface Favorites {
  live: number[]
  movies: number[]
  series: number[]
}

const STORAGE_KEY = 'nova-favorites'
const EVENT_NAME = 'nova-favorites-change'

function loadFavorites(): Favorites {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Favorites>
      return {
        live: Array.isArray(parsed.live) ? parsed.live : [],
        movies: Array.isArray(parsed.movies) ? parsed.movies : [],
        series: Array.isArray(parsed.series) ? parsed.series : [],
      }
    }
  } catch {
    // corrupted data — reset
  }
  return { live: [], movies: [], series: [] }
}

function saveFavorites(favs: Favorites) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs))
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorites>(loadFavorites)

  useEffect(() => {
    const handler = () => setFavorites(loadFavorites())
    window.addEventListener(EVENT_NAME, handler)
    return () => window.removeEventListener(EVENT_NAME, handler)
  }, [])

  const addFavorite = useCallback((type: FavoriteType, id: number) => {
    setFavorites((prev) => {
      if (prev[type].includes(id)) return prev
      const next = { ...prev, [type]: [...prev[type], id] }
      saveFavorites(next)
      return next
    })
  }, [])

  const removeFavorite = useCallback((type: FavoriteType, id: number) => {
    setFavorites((prev) => {
      const next = { ...prev, [type]: prev[type].filter((x) => x !== id) }
      saveFavorites(next)
      return next
    })
  }, [])

  const toggleFavorite = useCallback((type: FavoriteType, id: number) => {
    setFavorites((prev) => {
      let next: Favorites
      if (prev[type].includes(id)) {
        next = { ...prev, [type]: prev[type].filter((x) => x !== id) }
      } else {
        next = { ...prev, [type]: [...prev[type], id] }
      }
      saveFavorites(next)
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (type: FavoriteType, id: number) => favorites[type].includes(id),
    [favorites],
  )

  const count = favorites.live.length + favorites.movies.length + favorites.series.length

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    count,
  }
}

export type { FavoriteType }
