import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../../api/client.js'
import { seriesStreamUrl } from '../../api/streamUrl.js'
import { ErrorState } from '../../shared/ErrorState.js'
import { Header } from '../../shared/Header.js'
import { Loading } from '../../shared/Loading.js'
import { VideoPlayer } from '../../player/VideoPlayer.js'
import { useAuth } from '../auth/useAuth.js'
import type {
  SeriesCategoriesResponse,
  SeriesListResponse,
  XtreamCategory,
  XtreamEpisode,
  XtreamSeries,
  XtreamSeriesInfoResponse,
} from '../../types/index.js'

interface SeriesScreenProps {
  onBack: () => void
}

function useIsDesktopViewport() {
  const query = '(min-width: 768px)'
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    setIsDesktop(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isDesktop
}

type ViewState =
  | { type: 'categories' }
  | { type: 'series'; category: XtreamCategory }
  | { type: 'detail'; serie: XtreamSeries; category: XtreamCategory }
  | { type: 'player'; episode: XtreamEpisode; serie: XtreamSeries; category: XtreamCategory; maximized: boolean }

export function SeriesScreen({ onBack }: SeriesScreenProps) {
  const auth = useAuth()
  if (!auth || !auth.token) return null
  const { token } = auth
  const api = useMemo(() => createApiClient(token), [token])
  const [view, setView] = useState<ViewState>({ type: 'categories' })
  const [globalSearch, setGlobalSearch] = useState('')
  const isDesktop = useIsDesktopViewport()

  const categoriesQuery = useQuery({
    queryKey: ['series', 'categories'],
    queryFn: () => api.get<SeriesCategoriesResponse>('/api/series/categories'),
  })

  const allQuery = useQuery({
    queryKey: ['series', 'all'],
    queryFn: () => api.get<SeriesListResponse>('/api/series'),
    enabled: globalSearch.trim().length >= 2,
    staleTime: 5 * 60_000,
  })

  const term = globalSearch.trim().toLowerCase()
  const globalResults = useMemo(() => {
    if (term.length < 2 || !allQuery.data) return []
    return allQuery.data.series
      .filter((s) => s.name.toLowerCase().includes(term))
      .slice(0, 200)
  }, [term, allQuery.data])

  if (view.type === 'player') {
    const streamUrl = seriesStreamUrl(view.episode.id, view.episode.container_extension, token)

    if (view.maximized) {
      return (
        <div className="flex min-h-full flex-col">
          <Header
            title={view.serie.name}
            onBack={() => setView({ ...view, maximized: false })}
          />
          <div className="relative w-full flex-1 bg-black">
            <VideoPlayer src={streamUrl} title={view.episode.title} />
            <button
              type="button"
              onClick={() => setView({ ...view, maximized: false })}
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

    const playerBlock = (
      <div className="relative w-full overflow-hidden rounded-xl bg-black">
        <div className="aspect-video w-full">
          <VideoPlayer src={streamUrl} title={view.episode.title} />
        </div>
        <button
          type="button"
          onClick={() => setView({ ...view, maximized: true })}
          className="absolute right-2 top-2 z-10 rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm active:scale-95"
          aria-label="Maximizar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
          </svg>
        </button>
      </div>
    )

    const nowPlayingBlock = (
      <div className="rounded-xl bg-surface p-3 ring-1 ring-zinc-800">
        <p className="text-sm text-accent">Assistindo agora</p>
        <p className="mt-1 font-medium">{view.episode.title}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Episodio {view.episode.episode_num}
        </p>
      </div>
    )

    return (
      <div className={isDesktop ? 'fixed inset-0 z-50 flex flex-col bg-bg' : 'flex min-h-full flex-col'}>
        <Header
          title={view.serie.name}
          onBack={() => setView({ type: 'detail', serie: view.serie, category: view.category })}
        />
        {isDesktop ? (
          <div className="flex min-h-0 flex-1 flex-row gap-4 overflow-hidden p-4">
            <div className="flex min-h-0 w-1/2 shrink-0 flex-col overflow-hidden">
              <SeriesDetailContent
                serie={view.serie}
                api={api}
                onPlay={(episode) =>
                  setView({ type: 'player', episode, serie: view.serie, category: view.category, maximized: false })
                }
                scrollable
              />
            </div>
            <div className="flex w-1/2 shrink-0 flex-col gap-3">
              {playerBlock}
              {nowPlayingBlock}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0">
              <SeriesDetailContent
                serie={view.serie}
                api={api}
                onPlay={(episode) =>
                  setView({ type: 'player', episode, serie: view.serie, category: view.category, maximized: false })
                }
                renderMode="poster"
              />
            </div>
            <div className="shrink-0 px-4">
              {playerBlock}
              <div className="mt-3">{nowPlayingBlock}</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SeriesDetailContent
                serie={view.serie}
                api={api}
                onPlay={(episode) =>
                  setView({ type: 'player', episode, serie: view.serie, category: view.category, maximized: false })
                }
                renderMode="episodes"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (view.type === 'detail') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg">
        <Header
          title={view.serie.name}
          onBack={() => setView({ type: 'series', category: view.category })}
        />
        <div className="hidden min-h-0 flex-1 flex-row gap-4 overflow-hidden p-4 md:flex">
          <div className="flex min-h-0 w-1/2 shrink-0 flex-col overflow-hidden">
            <SeriesDetailContent
              serie={view.serie}
              api={api}
              onPlay={(episode) =>
                setView({ type: 'player', episode, serie: view.serie, category: view.category, maximized: false })
              }
              scrollable
            />
          </div>
          <div className="flex w-1/2 shrink-0 flex-col gap-3">
            <div className="relative w-full overflow-hidden rounded-xl bg-black">
              <div className="aspect-video w-full" />
            </div>
            <div className="rounded-xl bg-surface p-3 ring-1 ring-zinc-800">
              <p className="text-sm text-zinc-500">Selecione um episodio para assistir</p>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
          <div className="shrink-0">
            <SeriesDetailContent
              serie={view.serie}
              api={api}
              onPlay={(episode) =>
                setView({ type: 'player', episode, serie: view.serie, category: view.category, maximized: false })
              }
              renderMode="poster"
            />
          </div>
          <div className="shrink-0 px-4">
            <div className="relative w-full overflow-hidden rounded-xl bg-black">
              <div className="aspect-video w-full" />
            </div>
            <div className="mt-3 rounded-xl bg-surface p-3 ring-1 ring-zinc-800">
              <p className="text-sm text-zinc-500">Selecione um episodio para assistir</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SeriesDetailContent
              serie={view.serie}
              api={api}
              onPlay={(episode) =>
                setView({ type: 'player', episode, serie: view.serie, category: view.category, maximized: false })
              }
              renderMode="episodes"
            />
          </div>
        </div>
      </div>
    )
  }

  if (view.type === 'series') {
    return (
      <SeriesGrid
        category={view.category}
        api={api}
        onBack={() => setView({ type: 'categories' })}
        onSelect={(serie) =>
          setView({ type: 'detail', serie, category: view.category })
        }
      />
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header title="SERIES & NOVELAS" onBack={onBack} />
      <div className="border-b border-zinc-800 p-4">
        <input
          type="search"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Buscar em todas as series..."
          className="w-full rounded-xl bg-surface px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent"
        />
      </div>

      {term.length >= 2 ? (
        <>
          {allQuery.isPending && <Loading message="Buscando..." />}
          {allQuery.isError && (
            <ErrorState
              message={allQuery.error?.message ?? 'Erro na busca'}
              onRetry={() => allQuery.refetch()}
            />
          )}
          {allQuery.data && globalResults.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhuma serie encontrada.
            </div>
          )}
          {globalResults.length > 0 && (
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {globalResults.map((serie) => (
                <SerieCard
                  key={serie.series_id}
                  serie={serie}
                  onClick={() =>
                    setView({ type: 'detail', serie, category: { category_id: serie.category_id, category_name: '', parent_id: 0 } })
                  }
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
                categoriesQuery.error?.message ?? 'Erro ao carregar plataformas'
              }
              onRetry={() => categoriesQuery.refetch()}
            />
          )}
          {categoriesQuery.data && (
            <div className="grid gap-2 p-4">
              {categoriesQuery.data.categories.map((category) => (
                <button
                  key={category.category_id}
                  type="button"
                  onClick={() => setView({ type: 'series', category })}
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

interface SerieCardProps {
  serie: XtreamSeries
  onClick: () => void
}

function SerieCard({ serie, onClick }: SerieCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left"
    >
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
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">
        {serie.name}
      </p>
    </button>
  )
}

interface SeriesGridProps {
  category: XtreamCategory
  api: ReturnType<typeof createApiClient>
  onBack: () => void
  onSelect: (serie: XtreamSeries) => void
}

function SeriesGrid({ category, api, onBack, onSelect }: SeriesGridProps) {
  const query = useQuery({
    queryKey: ['series', 'list', category.category_id],
    queryFn: () =>
      api.get<SeriesListResponse>(
        `/api/series?category_id=${category.category_id}`,
      ),
  })
  const [search, setSearch] = useState('')

  const all = query.data?.series ?? []
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
          placeholder="Filtrar nesta plataforma..."
          className="w-full rounded-xl bg-surface px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent"
        />
      </div>
      {query.isPending && <Loading />}
      {query.isError && (
        <ErrorState
          message={query.error?.message ?? 'Erro ao carregar series'}
          onRetry={() => query.refetch()}
        />
      )}
      {query.data && (
        <>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhuma serie encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((serie) => (
                <SerieCard
                  key={serie.series_id}
                  serie={serie}
                  onClick={() => onSelect(serie)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface SeriesDetailContentProps {
  serie: XtreamSeries
  api: ReturnType<typeof createApiClient>
  onPlay: (episode: XtreamEpisode) => void
  scrollable?: boolean
  renderMode?: 'all' | 'poster' | 'episodes'
}

function SeriesDetailContent({ serie, api, onPlay, scrollable, renderMode = 'all' }: SeriesDetailContentProps) {
  const query = useQuery({
    queryKey: ['series', 'info', serie.series_id],
    queryFn: () =>
      api.get<XtreamSeriesInfoResponse>(`/api/series/${serie.series_id}`),
  })
  const [activeSeason, setActiveSeason] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const seasonKeys = useMemo(() => {
    if (!query.data) return []
    return Object.keys(query.data.episodes).sort(
      (a, b) => Number(a) - Number(b),
    )
  }, [query.data])

  const currentSeason = activeSeason ?? seasonKeys[0]
  const currentEpisodes = currentSeason
    ? query.data?.episodes[currentSeason] ?? []
    : []
  const filteredEpisodes = useMemo(() => {
    if (!search.trim()) return currentEpisodes
    const term = search.trim().toLowerCase()
    return currentEpisodes.filter(
      (e) =>
        e.title.toLowerCase().includes(term) ||
        String(e.episode_num).includes(term),
    )
  }, [currentEpisodes, search])

  if (query.isPending) return <Loading />
  if (query.isError) {
    return (
      <ErrorState
        message={query.error?.message ?? 'Erro ao carregar episodios'}
        onRetry={() => query.refetch()}
      />
    )
  }
  if (!query.data) return null

  const posterContent = (
    <div className="flex gap-4">
      <img
        src={query.data.info.cover || serie.cover}
        alt={serie.name}
        className="h-40 w-28 shrink-0 rounded-xl bg-surface object-cover ring-1 ring-zinc-800"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <div>
        <p className="text-sm text-accent">
          {query.data.info.releaseDate} • {query.data.info.genre}
        </p>
        <h2 className="text-xl font-semibold">{query.data.info.name}</h2>
        {query.data.info.plot && (
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-zinc-400">
            {query.data.info.plot}
          </p>
        )}
      </div>
    </div>
  )

  const episodesContent = (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {seasonKeys.map((season) => (
          <button
            key={season}
            type="button"
            onClick={() => setActiveSeason(season)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              currentSeason === season
                ? 'bg-accent text-white'
                : 'bg-surface text-zinc-300 ring-1 ring-zinc-800'
            }`}
          >
            T{season}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar episodios..."
          className="w-full rounded-xl bg-surface px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="mt-4 space-y-2">
        {filteredEpisodes.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Nenhum episodio encontrado.
          </div>
        ) : (
          filteredEpisodes.map((episode) => (
            <button
              key={episode.id}
              type="button"
              onClick={() => onPlay(episode)}
              className="flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left ring-1 ring-zinc-800 active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold text-zinc-500">
                {episode.episode_num}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{episode.title}</p>
                {episode.info?.plot && (
                  <p className="truncate text-xs text-zinc-500">
                    {episode.info.plot}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </>
  )

  if (renderMode === 'poster') {
    return <div className="p-4">{posterContent}</div>
  }

  if (renderMode === 'episodes') {
    return <div className="p-4">{episodesContent}</div>
  }

  if (scrollable) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        <div className="shrink-0">{posterContent}</div>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{episodesContent}</div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4">
      {posterContent}
      <div className="mt-6">{episodesContent}</div>
    </div>
  )
}
