import type { FastifyInstance } from 'fastify'
import type { FastifyPluginAsync } from 'fastify'

const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  }))
}

export default healthRoutes
export { healthRoutes }
