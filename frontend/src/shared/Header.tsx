interface HeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
}

export function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-bg/95 px-4 py-3 pt-safe backdrop-blur">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-zinc-800 active:scale-95"
        >
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
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-zinc-400">{subtitle}</p>
        )}
      </div>
    </header>
  )
}
