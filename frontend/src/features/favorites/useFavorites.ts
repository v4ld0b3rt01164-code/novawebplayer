import { useCallback, useEffect, useState } from 'react'

type FavoriteType = 'live' | 'movies' | 'series'

interface Favorites {
  live: number[]
  movies: number[]
  series: number[]
}

const STORAGE_KEY = 'nova-favorites'

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
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorites>(loadFavorites)

  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  const addFavorite = useCallback((type: FavoriteType, id: number) => {
    setFavorites((prev) => {
      if (prev[type].includes(id)) return prev
      return { ...prev, [type]: [...prev[type], id] }
    })
  }, [])

  const removeFavorite = useCallback((type: FavoriteType, id: number) => {
    setFavorites((prev) => ({
      ...prev,
      [type]: prev[type].filter((x) => x !== id),
    }))
  }, [])

  const toggleFavorite = useCallback((type: FavoriteType, id: number) => {
    setFavorites((prev) => {
      if (prev[type].includes(id)) {
        return { ...prev, [type]: prev[type].filter((x) => x !== id) }
      }
      return { ...prev, [type]: [...prev[type], id] }
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
