import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createApiClient } from '../../api/client.js'
import { liveStreamUrl, liveTranscodeUrl } from '../../api/streamUrl.js'
import { ErrorState } from '../../shared/ErrorState.js'
import { Header } from '../../shared/Header.js'
import { Loading } from '../../shared/Loading.js'
import { SectionTitle } from '../../shared/SectionTitle.js'
import { VideoPlayer } from '../../player/VideoPlayer.js'
import { useAuth } from '../auth/useAuth.js'
import { FavoriteButton } from '../favorites/FavoriteButton.js'
import { useFavorites } from '../favorites/useFavorites.js'
import type {
  EpgData,
  LiveCategoriesResponse,
  LiveStreamsResponse,
  XtreamCategory,
  XtreamLiveStream,
} from '../../types/index.js'
import { findNowNext, formatTime, getChannelEpg } from './epg.js'

const FAVORITES_CATEGORY: XtreamCategory = {
  category_id: '__favorites__',
  category_name: 'Favoritos',
  parent_id: 0,
}

interface LiveScreenProps {
  onBack: () => void
}

export function LiveScreen({ onBack }: LiveScreenProps) {
  const auth = useAuth()
  if (!auth || !auth.token) return null
  const { token } = auth
  const api = useMemo(() => createApiClient(token), [token])
  const [selectedCategory, setSelectedCategory] =
    useState<XtreamCategory | null>(null)
  const [selectedChannel, setSelectedChannel] =
    useState<XtreamLiveStream | null>(null)
  const [maximized, setMaximized] = useState(false)
  const { favorites } = useFavorites()

  const categoriesQuery = useQuery({
    queryKey: ['live', 'categories'],
    queryFn: () => api.get<LiveCategoriesResponse>('/api/live/categories'),
  })

  const isFavorites = selectedCategory?.category_id === '__favorites__'

  const streamsQuery = useQuery({
    queryKey: ['live', 'streams', selectedCategory?.category_id],
    queryFn: () =>
      api.get<LiveStreamsResponse>(
        `/api/live/streams?category_id=${selectedCategory?.category_id}`,
      ),
    enabled: !!selectedCategory && !isFavorites,
  })

  const allStreamsQuery = useQuery({
    queryKey: ['live', 'all-streams'],
    queryFn: () => api.get<LiveStreamsResponse>('/api/live/streams'),
    enabled: isFavorites,
    staleTime: 5 * 60_000,
  })

  const favoriteStreams = useMemo(() => {
    if (!isFavorites || !allStreamsQuery.data) return []
    return allStreamsQuery.data.streams.filter((s) => favorites.live.includes(s.stream_id))
  }, [isFavorites, allStreamsQuery.data, favorites.live])

  const effectiveStreams = isFavorites
    ? { streams: favoriteStreams }
    : streamsQuery.data

  const autoSelectDone = useRef(false)

  useEffect(() => {
    if (selectedCategory && effectiveStreams && effectiveStreams.streams.length > 0 && !selectedChannel && !autoSelectDone.current) {
      autoSelectDone.current = true
      setSelectedChannel(effectiveStreams.streams[0])
    }
  }, [selectedCategory, effectiveStreams, selectedChannel])

  useEffect(() => {
    if (!selectedCategory) {
      autoSelectDone.current = false
    }
  }, [selectedCategory])

  const epgQuery = useQuery({
    queryKey: ['epg'],
    queryFn: () => api.get<EpgData>('/api/epg'),
    staleTime: 5 * 60 * 1000,
  })

  if (selectedChannel && maximized) {
    return (
      <div className="flex min-h-full flex-col">
        <Header title={selectedChannel.name} onBack={() => { setMaximized(false); setSelectedChannel(null) }} />
        <div className="relative w-full flex-1 bg-black">
          <VideoPlayer
            src={liveStreamUrl(selectedChannel.stream_id, token)}
            fallbackSrc={liveTranscodeUrl(selectedChannel.stream_id, token)}
            title={selectedChannel.name}
          />
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
        <div className="flex-1 p-4">
          <EpgInfo channel={selectedChannel} epgData={epgQuery.data} />
        </div>
      </div>
    )
  }

  const channelList = selectedCategory ? (
    <ChannelListView
      category={selectedCategory}
      streams={effectiveStreams}
      isLoading={isFavorites ? allStreamsQuery.isPending : streamsQuery.isPending}
      error={isFavorites ? allStreamsQuery.error : streamsQuery.error}
      onRetry={isFavorites ? () => allStreamsQuery.refetch() : () => streamsQuery.refetch()}
      epgData={epgQuery.data}
      onSelectChannel={setSelectedChannel}
      onBack={() => setSelectedCategory(null)}
      compact={!!selectedChannel}
    />
  ) : (
    <CategoryListView
      categoriesQuery={categoriesQuery}
      favoritesCount={favorites.live.length}
      onSelectCategory={setSelectedCategory}
      onBack={onBack}
    />
  )

  if (selectedChannel) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg">
        <Header title={selectedChannel.name} onBack={() => setSelectedChannel(null)} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
          <div className="flex min-h-0 w-full shrink-0 flex-col gap-3 overflow-hidden md:order-2 md:w-1/2">
            <div className="relative w-full overflow-hidden rounded-xl bg-black">
              <div className="aspect-video w-full">
                <VideoPlayer
                  src={liveStreamUrl(selectedChannel.stream_id, token)}
                  fallbackSrc={liveTranscodeUrl(selectedChannel.stream_id, token)}
                  title={selectedChannel.name}
                />
              </div>
              <button
                type="button"
                onClick={() => setMaximized(true)}
                className="absolute right-2 top-2 z-10 rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm active:scale-95"
                aria-label="Maximizar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <EpgInfo channel={selectedChannel} epgData={epgQuery.data} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:order-1">
            {channelList}
          </div>
        </div>
      </div>
    )
  }

  return channelList
}

interface CategoryListViewProps {
  categoriesQuery: ReturnType<typeof useQuery<LiveCategoriesResponse>>
  favoritesCount: number
  onSelectCategory: (c: XtreamCategory) => void
  onBack: () => void
}

function CategoryListView({ categoriesQuery, favoritesCount, onSelectCategory, onBack }: CategoryListViewProps) {
  return (
    <div className="flex min-h-full flex-col">
      <Header title="TV AO VIVO" onBack={onBack} />
      {categoriesQuery.isPending && <Loading />}
      {categoriesQuery.isError && (
        <ErrorState
          message={categoriesQuery.error?.message ?? 'Erro ao carregar categorias'}
          onRetry={() => categoriesQuery.refetch()}
        />
      )}
      {categoriesQuery.data && (
        <div className="grid gap-2 p-4">
          <button
            type="button"
            onClick={() => onSelectCategory(FAVORITES_CATEGORY)}
            className="flex items-center justify-between rounded-xl bg-surface p-4 text-left ring-1 ring-zinc-800 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="font-medium">Favoritos</span>
            </div>
            <div className="flex items-center gap-2">
              {favoritesCount > 0 && (
                <span className="text-sm text-zinc-400">{favoritesCount}</span>
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
              onClick={() => onSelectCategory(category)}
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
    </div>
  )
}

interface ChannelListViewProps {
  category: XtreamCategory
  streams: LiveStreamsResponse | undefined
  isLoading: boolean
  error: Error | null
  epgData: EpgData | undefined
  onSelectChannel: (c: XtreamLiveStream) => void
  onBack: () => void
  onRetry: () => void
  compact?: boolean
}

function ChannelListView({ category, streams, isLoading, error, epgData, onSelectChannel, onBack, onRetry, compact }: ChannelListViewProps) {
  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'min-h-full'}`}>
      <Header title={category.category_name} onBack={onBack} />
      {isLoading && <Loading />}
      {error && (
        <ErrorState
          message={error?.message ?? 'Erro ao carregar canais'}
          onRetry={onRetry}
        />
      )}
      {streams && (
        <div className="grid gap-2 p-4">
          {streams.streams.length === 0 && (
            <p className="text-center text-sm text-zinc-500">Nenhum favorito nesta categoria.</p>
          )}
          {streams.streams.map((stream) => (
            <ChannelCard
              key={stream.stream_id}
              channel={stream}
              epgData={epgData}
              onClick={() => onSelectChannel(stream)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ChannelCardProps {
  channel: XtreamLiveStream
  epgData: EpgData | undefined
  onClick: () => void
}

function ChannelCard({ channel, epgData, onClick }: ChannelCardProps) {
  const channelEpg = getChannelEpg(epgData, channel.epg_channel_id)
  const { now, next } = findNowNext(channelEpg?.programmes ?? [])

  return (
    <button
      type="button"
      onClick={onClick}
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
        {now && (
          <p className="truncate text-xs text-zinc-400">
            {formatTime(now.start_timestamp)} {now.title}
          </p>
        )}
        {next && (
          <p className="truncate text-xs text-zinc-500">
            A seguir: {next.title}
          </p>
        )}
      </div>
      <FavoriteButton type="live" id={channel.stream_id} size="sm" />
    </button>
  )
}

function EpgInfo({ channel, epgData }: { channel: XtreamLiveStream; epgData: EpgData | undefined }) {
  const channelEpg = getChannelEpg(epgData, channel.epg_channel_id)
  const { now } = findNowNext(channelEpg?.programmes ?? [])

  return (
    <div className="space-y-3">
      {now ? (
        <>
          <p className="text-sm text-accent">
            AO VIVO • {formatTime(now.start_timestamp)} -{' '}
            {formatTime(now.stop_timestamp)}
          </p>
          <h2 className="text-lg font-semibold">{now.title}</h2>
          {now.description && (
            <p className="text-sm leading-relaxed text-zinc-400">
              {now.description}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-500">Programacao nao disponivel.</p>
      )}

      {channelEpg && channelEpg.programmes.length > 0 && (
        <>
          <SectionTitle>Mini guia</SectionTitle>
          <div className="space-y-2">
            {channelEpg.programmes.slice(0, 8).map((prog) => (
              <div
                key={`${prog.start}-${prog.title}`}
                className="flex gap-3 rounded-xl bg-surface p-3"
              >
                <span className="w-14 shrink-0 text-sm text-zinc-500">
                  {formatTime(prog.start_timestamp)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{prog.title}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {prog.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
