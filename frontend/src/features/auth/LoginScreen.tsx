import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createApiClient } from '../../api/client.js'
import type { XtreamAuthResponse } from '../../types/index.js'
import { useAuth } from './useAuth.js'

export function LoginScreen() {
  const auth = useAuth()
  if (!auth) return null
  const { login } = auth
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const api = createApiClient(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.post<XtreamAuthResponse>('/api/auth', { username, password }),
    onSuccess: (data) => {
      login(data)
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    mutation.mutate()
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-3xl font-bold tracking-tight">
          NOVA <span className="text-accent">Web Player</span>
        </h1>
        <p className="text-center text-sm text-zinc-400">
          Entre com seu usuário e senha do painel.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="sr-only">
              Usuário
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-surface px-4 py-3.5 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-surface px-4 py-3.5 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          {mutation.isError && (
            <p className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300 ring-1 ring-red-900">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Erro ao entrar. Tente novamente.'}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-xl bg-accent py-3.5 font-semibold text-white shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-60"
          >
            {mutation.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
