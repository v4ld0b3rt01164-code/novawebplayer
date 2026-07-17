/**
 * Cliente HTTP do frontend.
 *
 * REGRA (AGENTS.md): o frontend fala APENAS com o backend próprio
 * (`/api/...` e `/stream/...` na mesma origem). Nunca chamar os domínios
 * IPTV diretamente daqui.
 */

import { ApiError } from '../types/errors.js'

const BASE = '' // mesma origem; em dev, o proxy do Vite repassa /api e /stream

async function request<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init?.headers,
  }
  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
    })
  } catch {
    throw new ApiError(0, 'Falha de rede. Verifique sua conexão.')
  }

  if (!res.ok) {
    let message = `Erro ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // resposta sem corpo JSON — mantém mensagem genérica
    }
    throw new ApiError(res.status, message)
  }

  return (await res.json()) as T
}

export function createApiClient(token: string | null) {
  return {
    get: <T>(path: string) => request<T>(path, undefined, token),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
