interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <p className="max-w-xs text-sm text-red-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-surface px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-800 active:scale-[0.98]"
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}
