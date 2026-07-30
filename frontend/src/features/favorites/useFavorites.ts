import { useCallback, useEffect, useState } from 'react'

type FavoriteType = 'live' | 'movies' | 'series'

interface Favorites {
  live: number[]
  movies: number[]
  series: number[]
}

const STORAGE_KEY = 'nova-favorites'

function loadFromStorage(): Favorites {
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
  } catch { /* corrupted */ }
  return { live: [], movies: [], series: [] }
}

let cached: Favorites = loadFromStorage()
let listeners: Array<() => void> = []

function update(next: Favorites) {
  cached = next
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  for (const l of listeners) l()
}

export function useFavorites() {
  const [favorites, setFavorites] = useState(cached)

  useEffect(() => {
    const handler = () => setFavorites(cached)
    listeners.push(handler)
    return () => { listeners = listeners.filter(l => l !== handler) }
  }, [])

  const addFavorite = useCallback((type: FavoriteType, id: number) => {
    if (cached[type].includes(id)) return
    update({ ...cached, [type]: [...cached[type], id] })
  }, [])

  const removeFavorite = useCallback((type: FavoriteType, id: number) => {
    update({ ...cached, [type]: cached[type].filter(x => x !== id) })
  }, [])

  const toggleFavorite = useCallback((type: FavoriteType, id: number) => {
    if (cached[type].includes(id)) {
      update({ ...cached, [type]: cached[type].filter(x => x !== id) })
    } else {
      update({ ...cached, [type]: [...cached[type], id] })
    }
  }, [])

  const isFavorite = useCallback(
    (type: FavoriteType, id: number) => cached[type].includes(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favorites],
  )

  const count = favorites.live.length + favorites.movies.length + favorites.series.length

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite, count }
}

export type { FavoriteType }
