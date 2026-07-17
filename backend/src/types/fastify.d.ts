import type { Session } from '../session/store.js'

declare module 'fastify' {
  interface FastifyRequest {
    session?: Session
  }
}
