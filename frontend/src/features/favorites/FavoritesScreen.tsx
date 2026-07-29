import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { createApiClient } from '../../api/client.js'
import { liveStreamUrl, liveTranscodeUrl } from '../../api/streamUrl.js'
import { ErrorState } from '../../shared/ErrorState.js'
import { Header } from '../../shared/Header.js'
import { Loading } from '../../shared/Loading.js'
import { VideoPlayer } from '../../player/VideoPlayer.js'
import { useAuth } from '../auth/useAuth.js'
import { useFavorites } from './useFavorites.js'
import { FavoriteButton } from './FavoriteButton.js'
import type {
  LiveStreamsResponse,
  VodStreamsResponse,
  SeriesListResponse,
  XtreamLiveStream,
  XtreamVodStream,
  XtreamSeries,
} from '../../types/index.js'

interface FavoritesScreenProps {
  onBack: () => void
}

type FavoriteFilter = 'all' | 'live' | 'movies' | 'series'

type PlayingItem =
  | { type: 'live'; item: XtreamLiveStream }
  | { type: 'movies'; item: XtreamVodStream }
  | { type: 'series'; item: XtreamSeries }

export function FavoritesScreen({ onBack }: FavoritesScreenProps) {
  const auth = useAuth()
  if (!auth || !auth.token) return null
  const { token } = auth
  const api = useMemo(() => createApiClient(token), [token])
  const { favorites } = useFavorites()
  const [filter, setFilter] = useState<FavoriteFilter>('all')
  const [playing, setPlaying] = useState<PlayingItem | null>(null)

  const liveIds = favorites.live
  const movieIds = favorites.movies
  const seriesIds = favorites.series

  const liveQuery = useQuery({
    queryKey: ['favorites', 'live'],
    queryFn: () => api.get<LiveStreamsResponse>('/api/live/streams'),
    enabled: liveIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const moviesQuery = useQuery({
    queryKey: ['favorites', 'movies'],
    queryFn: () => api.get<VodStreamsResponse>('/api/movies/streams'),
    enabled: movieIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const seriesQuery = useQuery({
    queryKey: ['favorites', 'series'],
    queryFn: () => api.get<SeriesListResponse>('/api/series'),
    enabled: seriesIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const favoriteLive = useMemo(() => {
    if (!liveQuery.data) return []
    return liveQuery.data.streams.filter((s) => liveIds.includes(s.stream_id))
  }, [liveQuery.data, liveIds])

  const favoriteMovies = useMemo(() => {
    if (!moviesQuery.data) return []
    return moviesQuery.data.streams.filter((s) => movieIds.includes(s.stream_id))
  }, [moviesQuery.data, movieIds])

  const favoriteSeries = useMemo(() => {
    if (!seriesQuery.data) return []
    return seriesQuery.data.series.filter((s) => seriesIds.includes(s.series_id))
  }, [seriesQuery.data, seriesIds])

  const totalFavorites = favoriteLive.length + favoriteMovies.length + favoriteSeries.length
  const isLoading = liveQuery.isPending || moviesQuery.isPending || seriesQuery.isPending
  const hasError = liveQuery.isError || moviesQuery.isError || seriesQuery.isError

  if (playing) {
    if (playing.type === 'live') {
      return (
        <div className="flex min-h-full flex-col">
          <Header title={playing.item.name} onBack={() => setPlaying(null)} />
          <div className="flex-1 bg-black">
            <VideoPlayer
              src={liveStreamUrl(playing.item.stream_id, token)}
              fallbackSrc={liveTranscodeUrl(playing.item.stream_id, token)}
              title={playing.item.name}
            />
          </div>
        </div>
      )
    }

    if (playing.type === 'movies') {
      return (
        <div className="flex min-h-full flex-col">
          <Header title={playing.item.name} onBack={() => setPlaying(null)} />
          <div className="flex-1 bg-black">
            <VideoPlayer
              src={`/stream/movie/${playing.item.stream_id}.${playing.item.container_extension || 'mp4'}?token=${encodeURIComponent(token)}`}
              fallbackSrc={`/transcode/movie/${playing.item.stream_id}.${playing.item.container_extension || 'mp4'}?token=${encodeURIComponent(token)}`}
              title={playing.item.name}
            />
          </div>
        </div>
      )
    }
  }

  const filters: { id: FavoriteFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: totalFavorites },
    { id: 'live', label: 'Live', count: favoriteLive.length },
    { id: 'movies', label: 'Filmes', count: favoriteMovies.length },
    { id: 'series', label: 'Series', count: favoriteSeries.length },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <Header title="FAVORITOS" onBack={onBack} />

      <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 px-4 pb-3 pt-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === f.id
                ? 'bg-accent text-white'
                : 'bg-surface text-zinc-300 ring-1 ring-zinc-800'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {isLoading && <Loading />}
      {hasError && (
        <ErrorState
          message="Erro ao carregar favoritos"
          onRetry={() => {
            liveQuery.refetch()
            moviesQuery.refetch()
            seriesQuery.refetch()
          }}
        />
      )}

      {!isLoading && !hasError && totalFavorites === 0 && (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto text-zinc-600"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p className="mt-4 text-sm text-zinc-500">
              Nenhum favorito adicionado ainda.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Toque no icone de coracao nos canais, filmes ou series para favoritar.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !hasError && totalFavorites > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          {(filter === 'all' || filter === 'live') && favoriteLive.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-zinc-400">TV AO VIVO</h2>
              <div className="grid gap-2">
                {favoriteLive.map((channel) => (
                  <button
                    key={channel.stream_id}
                    type="button"
                    onClick={() => setPlaying({ type: 'live', item: channel })}
                    className="flex min-h-[72px] items-center gap-3 rounded-xl bg-surface p-3 text-left ring-1 ring-zinc-800 active:scale-[0.98]"
                  >
                    <img
                      src={channel.stream_icon}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-lg bg-surface-2 object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{channel.name}</p>
                    </div>
                    <FavoriteButton type="live" id={channel.stream_id} size="sm" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {(filter === 'all' || filter === 'movies') && favoriteMovies.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-zinc-400">FILMES</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {favoriteMovies.map((movie) => (
                  <button
                    key={movie.stream_id}
                    type="button"
                    onClick={() => setPlaying({ type: 'movies', item: movie })}
                    className="group text-left"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface ring-1 ring-zinc-800">
                      <img
                        src={movie.stream_icon}
                        alt={movie.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-active:scale-95"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <div className="absolute right-2 top-2">
                        <FavoriteButton type="movies" id={movie.stream_id} size="sm" />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">
                      {movie.name}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(filter === 'all' || filter === 'series') && favoriteSeries.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-zinc-400">SERIES & NOVELAS</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {favoriteSeries.map((serie) => (
                  <div key={serie.series_id} className="group text-left">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface ring-1 ring-zinc-800">
                      <img
                        src={serie.cover}
                        alt={serie.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-active:scale-95"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <div className="absolute right-2 top-2">
                        <FavoriteButton type="series" id={serie.series_id} size="sm" />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">
                      {serie.name}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
