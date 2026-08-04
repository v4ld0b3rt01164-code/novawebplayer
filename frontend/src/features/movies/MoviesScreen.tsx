import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { createApiClient } from '../../api/client.js'
import { movieStreamUrl, movieTranscodeUrl } from '../../api/streamUrl.js'
import { ErrorState } from '../../shared/ErrorState.js'
import { Header } from '../../shared/Header.js'
import { Loading } from '../../shared/Loading.js'
import { VideoPlayer } from '../../player/VideoPlayer.js'
import { canUseIosNativeFullscreen, enterIosFullscreen } from '../../player/fullscreen.js'
import { useAuth } from '../auth/useAuth.js'
import { FavoriteButton } from '../favorites/FavoriteButton.js'
import { useFavorites } from '../favorites/useFavorites.js'
import type {
  VodCategoriesResponse,
  VodStreamsResponse,
  XtreamCategory,
  XtreamVodStream,
} from '../../types/index.js'

const FAVORITES_CATEGORY: XtreamCategory = {
  category_id: '__favorites__',
  category_name: 'Favoritos',
  parent_id: 0,
}

interface MoviesScreenProps {
  onBack: () => void
}

type View =
  | { type: 'home' }
  | { type: 'category'; category: XtreamCategory }
  | { type: 'movie'; movie: XtreamVodStream }

export function MoviesScreen({ onBack }: MoviesScreenProps) {
  const auth = useAuth()
  if (!auth || !auth.token) return null
  const { token } = auth
  const api = useMemo(() => createApiClient(token), [token])
  const [view, setView] = useState<View>({ type: 'home' })
  const [globalSearch, setGlobalSearch] = useState('')
  const [maximized, setMaximized] = useState(false)
  const { favorites } = useFavorites()
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const onVideoElement = useCallback(
    (el: HTMLVideoElement | null) => {
      videoElRef.current = el
    },
    [],
  )

  const categoriesQuery = useQuery({
    queryKey: ['movies', 'categories'],
    queryFn: () => api.get<VodCategoriesResponse>('/api/movies/categories'),
  })

  const allQuery = useQuery({
    queryKey: ['movies', 'all'],
    queryFn: () => api.get<VodStreamsResponse>('/api/movies/streams'),
    enabled: globalSearch.trim().length >= 2 || view.type === 'category' && view.category.category_id === '__favorites__',
    staleTime: 5 * 60_000,
  })

  const term = globalSearch.trim().toLowerCase()
  const globalResults = useMemo(() => {
    if (term.length < 2 || !allQuery.data) return []
    return allQuery.data.streams
      .filter((s) => s.name.toLowerCase().includes(term))
      .slice(0, 200)
  }, [term, allQuery.data])

  if (view.type === 'movie' && maximized) {
    const streamUrl = movieStreamUrl(view.movie.stream_id, view.movie.container_extension, token)
    const transcodeUrl = movieTranscodeUrl(view.movie.stream_id, view.movie.container_extension, token)
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg">
        <Header title={view.movie.name} onBack={() => { setMaximized(false); setView({ type: 'home' }) }} />
        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-black">
                <VideoPlayer src={streamUrl} fallbackSrc={transcodeUrl} title={view.movie.name} onVideoElement={onVideoElement} />
          <button
            type="button"
            onClick={() => setMaximized(false)}
            className="absolute right-3 top-3 z-10 rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm active:scale-95"
            aria-label="Minimizar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  if (view.type === 'movie') {
    const streamUrl = movieStreamUrl(view.movie.stream_id, view.movie.container_extension, token)
    const transcodeUrl = movieTranscodeUrl(view.movie.stream_id, view.movie.container_extension, token)
    return (
      <div className="flex min-h-full flex-col">
        <Header title={view.movie.name} onBack={() => setView({ type: 'home' })} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MovieInfo movie={view.movie} api={api} />
          </div>
          <div className="flex w-full flex-col gap-3 md:w-1/2 md:shrink-0">
            <div className="relative w-full overflow-hidden rounded-xl bg-black">
              <div className="aspect-video w-full">
          <VideoPlayer src={streamUrl} fallbackSrc={transcodeUrl} title={view.movie.name} onVideoElement={onVideoElement} />
              </div>
              <button
                type="button"
                onClick={() => {
                  // iOS: o fullscreen nativo assume a tela (sem trocar o estado,
                  // senao o React desmonta o <video> e o iOS cancela o fullscreen).
                  if (canUseIosNativeFullscreen(videoElRef.current)) {
                    enterIosFullscreen(videoElRef.current)
                    return
                  }
                  setMaximized(true)
                }}
                className="absolute right-2 top-2 z-10 rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm active:scale-95"
                aria-label="Maximizar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (view.type === 'category') {
    return (
      <CategoryView
        category={view.category}
        api={api}
        favorites={favorites.movies}
        allQuery={allQuery}
        onBack={() => setView({ type: 'home' })}
        onSelectMovie={(movie) => setView({ type: 'movie', movie })}
      />
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header title="FILMES" onBack={onBack} />
      <div className="border-b border-zinc-800 p-4">
        <input
          type="search"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Buscar em todos os filmes…"
          className="w-full rounded-xl bg-surface px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent"
        />
      </div>

      {term.length >= 2 ? (
        <>
          {allQuery.isPending && <Loading message="Buscando…" />}
          {allQuery.isError && (
            <ErrorState
              message={allQuery.error?.message ?? 'Erro na busca'}
              onRetry={() => allQuery.refetch()}
            />
          )}
          {allQuery.data && globalResults.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhum filme encontrado.
            </div>
          )}
          {globalResults.length > 0 && (
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {globalResults.map((movie) => (
                <MovieCard
                  key={movie.stream_id}
                  movie={movie}
                  onClick={() => setView({ type: 'movie', movie })}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {categoriesQuery.isPending && <Loading />}
          {categoriesQuery.isError && (
            <ErrorState
              message={
                categoriesQuery.error?.message ??
                'Erro ao carregar categorias'
              }
              onRetry={() => categoriesQuery.refetch()}
            />
          )}
          {categoriesQuery.data && (
            <div className="grid gap-2 p-4">
              <button
                type="button"
                onClick={() => setView({ type: 'category', category: FAVORITES_CATEGORY })}
                className="flex items-center justify-between rounded-xl bg-surface p-4 text-left ring-1 ring-zinc-800 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span className="font-medium">Favoritos</span>
                </div>
                <div className="flex items-center gap-2">
                  {favorites.movies.length > 0 && (
                    <span className="text-sm text-zinc-400">{favorites.movies.length}</span>
                  )}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
              {categoriesQuery.data.categories.map((category) => (
                <button
                  key={category.category_id}
                  type="button"
                  onClick={() => setView({ type: 'category', category })}
                  className="flex items-center justify-between rounded-xl bg-surface p-4 text-left ring-1 ring-zinc-800 active:scale-[0.98]"
                >
                  <span className="font-medium">{category.category_name}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface CategoryViewProps {
  category: XtreamCategory
  api: ReturnType<typeof createApiClient>
  favorites: number[]
  allQuery: ReturnType<typeof useQuery<VodStreamsResponse>>
  onBack: () => void
  onSelectMovie: (movie: XtreamVodStream) => void
}

function CategoryView({
  category,
  api,
  favorites,
  allQuery,
  onBack,
  onSelectMovie,
}: CategoryViewProps) {
  const [search, setSearch] = useState('')
  const isFavorites = category.category_id === '__favorites__'

  const query = useQuery({
    queryKey: ['movies', 'streams', category.category_id],
    queryFn: () =>
      api.get<VodStreamsResponse>(
        `/api/movies/streams?category_id=${category.category_id}`,
      ),
    enabled: !isFavorites,
  })

  const all = useMemo(() => {
    if (isFavorites) {
      if (!allQuery.data) return []
      return allQuery.data.streams.filter((s) => favorites.includes(s.stream_id))
    }
    return query.data?.streams ?? []
  }, [isFavorites, allQuery.data, favorites, query.data])

  const isLoading = isFavorites ? allQuery.isPending : query.isPending
  const error = isFavorites ? allQuery.error : query.error

  const filtered = useMemo(() => {
    if (!search.trim()) return all
    const term = search.trim().toLowerCase()
    return all.filter((s) => s.name.toLowerCase().includes(term))
  }, [all, search])

  return (
    <div className="flex min-h-full flex-col">
      <Header title={category.category_name} onBack={onBack} />
      <div className="border-b border-zinc-800 p-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar nesta categoria…"
          className="w-full rounded-xl bg-surface px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent"
        />
      </div>
      {isLoading && <Loading />}
      {error && (
        <ErrorState
          message={error?.message ?? 'Erro ao carregar filmes'}
          onRetry={() => isFavorites ? allQuery.refetch() : query.refetch()}
        />
      )}
      {!isLoading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhum filme encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((movie) => (
                <MovieCard
                  key={movie.stream_id}
                  movie={movie}
                  onClick={() => onSelectMovie(movie)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface MovieCardProps {
  movie: XtreamVodStream
  onClick: () => void
}

function MovieCard({ movie, onClick }: MovieCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  )
}

function MovieInfo({ movie, api }: { movie: XtreamVodStream; api: ReturnType<typeof createApiClient> }) {
  const infoQuery = useQuery({
    queryKey: ['movie', 'info', movie.stream_id],
    queryFn: () => api.get<{ info: { plot?: string; genre?: string; releaseDate?: string; duration?: string; rating?: string; director?: string; cast?: string } }>(`/api/movies/${movie.stream_id}`),
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <img
          src={movie.stream_icon}
          alt={movie.name}
          className="h-48 w-32 shrink-0 rounded-xl bg-surface object-cover ring-1 ring-zinc-800"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{movie.name}</h2>
          {infoQuery.data?.info && (
            <>
              {(infoQuery.data.info.releaseDate || infoQuery.data.info.genre) && (
                <p className="mt-1 text-sm text-accent">
                  {[infoQuery.data.info.releaseDate, infoQuery.data.info.genre].filter(Boolean).join(' • ')}
                </p>
              )}
              {infoQuery.data.info.duration && (
                <p className="mt-1 text-sm text-zinc-400">{infoQuery.data.info.duration}</p>
              )}
              {infoQuery.data.info.rating && (
                <p className="mt-1 text-sm text-zinc-500">Nota: {infoQuery.data.info.rating}</p>
              )}
            </>
          )}
        </div>
      </div>

      {infoQuery.data?.info?.plot && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300">Sinopse</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            {infoQuery.data.info.plot}
          </p>
        </div>
      )}

      {infoQuery.data?.info?.director && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300">Diretor</h3>
          <p className="mt-1 text-sm text-zinc-400">{infoQuery.data.info.director}</p>
        </div>
      )}

      {infoQuery.data?.info?.cast && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300">Elenco</h3>
          <p className="mt-1 text-sm text-zinc-400">{infoQuery.data.info.cast}</p>
        </div>
      )}
    </div>
  )
}
