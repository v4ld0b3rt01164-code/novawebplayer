interface MenuScreenProps {
  onSelect: (screen: 'live' | 'movies' | 'series') => void
}

const ITEMS = [
  { id: 'live' as const, label: 'TV AO VIVO', icon: '/tv-ao-vivo.svg' },
  { id: 'movies' as const, label: 'FILMES', icon: '/filmes.svg' },
  {
    id: 'series' as const,
    label: 'SÉRIES & NOVELAS',
    icon: '/series-novelas.svg',
  },
]

export function MenuScreen({ onSelect }: MenuScreenProps) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          O que deseja assistir?
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Escolha uma categoria abaixo.
        </p>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className="group flex w-full flex-col items-center justify-center gap-3 p-4 transition active:scale-[0.98] md:gap-6 md:p-10"
            aria-label={item.label}
          >
            <img
              src={item.icon}
              alt=""
              className="h-20 w-20 object-contain transition group-active:scale-95 md:h-48 md:w-48"
              draggable={false}
            />
              <span className="text-base font-semibold tracking-wide md:text-3xl">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}
