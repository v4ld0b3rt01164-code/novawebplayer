import { randomUUID } from 'node:crypto'
import type { ActiveServer } from '../iptv/auth.js'

const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

export interface Session {
  token: string
  server: ActiveServer
  createdAt: number
  expiresAt: number
  blockedServers: Set<string>
}

const sessions = new Map<string, Session>()

function cleanExpired(): void {
  const now = Date.now()
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token)
  }
}

export function createSession(server: ActiveServer): string {
  cleanExpired()
  const token = randomUUID()
  const now = Date.now()
  sessions.set(token, {
    token,
    server,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    blockedServers: new Set(),
  })
  return token
}

export function getSession(token: string | undefined): Session | null {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  return session
}

export function destroySession(token: string): void {
  sessions.delete(token)
}

/**
 * Atualiza o servidor ativo de uma sessão existente (usado pelo fallback de
 * stream). Muta o objeto em memória — qualquer referência já obtida via
 * getSession() (ex: req.session) passa a enxergar o novo servidor.
 */
export function updateSessionServer(token: string, server: ActiveServer): void {
  const session = sessions.get(token)
  if (!session) return
  session.server = server
}
