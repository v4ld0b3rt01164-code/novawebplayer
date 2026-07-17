import type { FastifyReply, FastifyRequest } from 'fastify'
import { getSession } from '../session/store.js'

function extractBearerToken(req: FastifyRequest): string | undefined {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return undefined
  return auth.slice(7)
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(req)
  const session = getSession(token)
  if (!session) {
    return reply.status(401).send({ error: 'Sessão inválida ou expirada.' })
  }
  req.session = session
}
