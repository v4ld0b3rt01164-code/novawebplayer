import { randomInt } from 'node:crypto'
import {
  IPTV_CANDIDATES,
} from './servers.js'
import type { XtreamAuthResponse } from './types.js'

export interface ActiveServer {
  baseUrl: string
  username: string
  password: string
}

const AUTH_TIMEOUT_MS = 5000
const PLAYER_API_PATH = '/player_api.php'

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }
  return items
}

/**
 * Tenta autenticar em um único domínio Xtream Codes.
 *
 * Sucesso: HTTP 200 + user_info.auth === 1.
 * Nunca loga/retorna as credenciais brutas.
 */
async function tryAuthenticate(
  baseUrl: string,
  username: string,
  password: string,
): Promise<XtreamAuthResponse | null> {
  const url = new URL(PLAYER_API_PATH, baseUrl)
  url.searchParams.set('username', username)
  url.searchParams.set('password', password)

  let res: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
    res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timer)
  } catch {
    return null
  }

  if (!res.ok) return null

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    return null
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'user_info' in payload &&
    (payload as XtreamAuthResponse).user_info?.auth === 1
  ) {
    return payload as XtreamAuthResponse
  }

  return null
}

/**
 * Embaralha e percorre os domínios candidatos até um autenticar com sucesso.
 *
 * @param excludeBaseUrls domínios a pular (ex: sabidamente bloqueados nesta
 * sessão). Usado pelo fallback em nível de stream; login normal não passa nada.
 * @throws Error quando todos os domínios (não excluídos) falham, ou quando a
 * exclusão elimina todos os candidatos.
 */
export async function authenticate(
  username: string,
  password: string,
  excludeBaseUrls: ReadonlySet<string> = new Set(),
): Promise<{ response: XtreamAuthResponse; server: ActiveServer }> {
  const candidates = shuffle(
    IPTV_CANDIDATES.filter((baseUrl) => !excludeBaseUrls.has(baseUrl)),
  )

  if (candidates.length === 0) {
    throw new Error('Todos os servidores candidatos estão bloqueados nesta sessão.')
  }

  for (const baseUrl of candidates) {
    const response = await tryAuthenticate(baseUrl, username, password)
    if (response) {
      return {
        response,
        server: { baseUrl, username, password },
      }
    }
  }

  throw new Error(
    'Não foi possível conectar a nenhum servidor. Verifique usuário/senha ou tente novamente mais tarde.',
  )
}
