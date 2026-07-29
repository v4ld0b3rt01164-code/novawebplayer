import type { FavoriteType } from './useFavorites'
import { useFavorites } from './useFavorites'

interface FavoriteButtonProps {
  type: FavoriteType
  id: number
  size?: 'sm' | 'md'
  className?: string
}

export function FavoriteButton({ type, id, size = 'md', className = '' }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const active = isFavorite(type, id)

  const sizeClasses = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const iconSize = size === 'sm' ? 16 : 20

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggleFavorite(type, id)
      }}
      aria-label={active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      className={`flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition active:scale-90 ${sizeClasses} ${className}`}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? 'text-red-500' : 'text-white'}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}
