interface LoadingProps {
  message?: string
}

export function Loading({ message = 'Carregando…' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-zinc-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-accent" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
