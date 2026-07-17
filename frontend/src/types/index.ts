/**
 * Tipagens Xtream Codes compartilhadas entre frontend e backend.
 */

export interface XtreamUserInfo {
  auth: number
  status: string
  exp_date: string | null
  is_trial: string
  active_cons: number
  created_at: string | null
  max_connections: string
  allowed_output_formats: string[]
  username: string
  password: string
  message?: string
}

export interface XtreamAuthResponse {
  token: string
  user_info: XtreamUserInfo
}

export interface XtreamCategory {
  category_id: string
  category_name: string
  parent_id: number | string
}

export interface XtreamLiveStream {
  num: number
  name: string
  stream_type: 'live'
  stream_id: number
  stream_icon: string
  epg_channel_id?: string | null
  added: string
  category_id: string
  custom_sid: string
  tv_archive: number
  direct_source: string
  tv_archive_duration: number
}

export interface XtreamVodStream {
  num: number
  name: string
  stream_type: 'movie'
  stream_id: number
  stream_icon: string
  rating: string
  rating_5based: number
  added: string
  category_id: string
  container_extension: string
  custom_sid: string
  direct_source: string
}

export interface XtreamVodInfoResponse {
  info: {
    name: string
    cover: string
    plot: string
    cast: string
    rating: string
    director: string
    genre: string
    releaseDate: string
    duration: string
    duration_secs: number
    youtube_trailer: string
  }
  movie_data: XtreamVodStream
}

export interface XtreamSeries {
  num: number
  name: string
  series_id: number
  cover: string
  plot: string
  cast: string
  director: string
  genre: string
  releaseDate: string
  last_modified: string
  rating: string
  rating_5based: number
  backdrop_path: string[]
  youtube_trailer: string
  episode_run_time: string
  category_id: string
}

export interface XtreamEpisode {
  id: string
  episode_num: number
  title: string
  container_extension: string
  info: {
    movie_image?: string
    plot?: string
    releasedate?: string
    duration_secs?: number
    duration?: string
  }
  subtiles: unknown[]
}

export interface XtreamSeriesInfoResponse {
  seasons: { name: string; episode_num: string; overview: string; air_date: string }[] | null
  info: {
    name: string
    cover: string
    plot: string
    cast: string
    director: string
    genre: string
    releaseDate: string
    rating: string
    rating_5based: number
    backdrop_path: string[]
    youtube_trailer: string
    episode_run_time: string
  }
  episodes: Record<string, XtreamEpisode[]>
}

export interface XtreamShortEpgItem {
  id: string
  title: string
  description: string
  start: string
  end: string
  start_timestamp: number
  stop_timestamp: number
}

export interface XtreamShortEpgResponse {
  epg_listings: XtreamShortEpgItem[]
}

export interface EpgProgramme {
  title: string
  description: string
  start: string
  stop: string
  start_timestamp: number
  stop_timestamp: number
}

export interface EpgChannel {
  name: string
  programmes: EpgProgramme[]
}

export interface EpgData {
  generatedAt: number
  channels: Record<string, EpgChannel>
}

export interface LiveCategoriesResponse {
  categories: XtreamCategory[]
}

export interface LiveStreamsResponse {
  streams: XtreamLiveStream[]
}

export interface VodCategoriesResponse {
  categories: XtreamCategory[]
}

export interface VodStreamsResponse {
  streams: XtreamVodStream[]
}

export interface SeriesCategoriesResponse {
  categories: XtreamCategory[]
}

export interface SeriesListResponse {
  series: XtreamSeries[]
}
