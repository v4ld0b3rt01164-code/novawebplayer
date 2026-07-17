import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './features/auth/useAuth.ts'
import { LoginScreen } from './features/auth/LoginScreen.tsx'
import { LiveScreen } from './features/live/LiveScreen.tsx'
import { MenuScreen } from './features/menu/MenuScreen.tsx'
import { MoviesScreen } from './features/movies/MoviesScreen.tsx'
import { SeriesScreen } from './features/series/SeriesScreen.tsx'

type Screen = 'menu' | 'live' | 'movies' | 'series'

function App() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [screen, setScreen] = useState<Screen>('menu')

  if (!auth || !auth.token) {
    return (
      <div className="min-h-full bg-bg text-zinc-100">
        <LoginScreen />
      </div>
    )
  }

  const logout = () => {
    auth.logout()
    queryClient.clear()
    setScreen('menu')
  }

  switch (screen) {
    case 'live':
      return (
        <div className="min-h-full bg-bg text-zinc-100">
          <LiveScreen onBack={() => setScreen('menu')} />
        </div>
      )
    case 'movies':
      return (
        <div className="min-h-full bg-bg text-zinc-100">
          <MoviesScreen onBack={() => setScreen('menu')} />
        </div>
      )
    case 'series':
      return (
        <div className="min-h-full bg-bg text-zinc-100">
          <SeriesScreen onBack={() => setScreen('menu')} />
        </div>
      )
    default:
      return (
        <div className="relative min-h-full bg-bg text-zinc-100">
          <button
            type="button"
            onClick={logout}
            className="absolute right-4 top-4 z-20 rounded-lg bg-surface px-3 py-2 text-xs font-semibold ring-1 ring-zinc-800"
          >
            Sair
          </button>
          <MenuScreen onSelect={setScreen} />
        </div>
      )
  }
}

export default App
