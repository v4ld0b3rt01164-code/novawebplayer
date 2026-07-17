import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import * as epg from '../iptv/epg.js'
import { requireAuth } from './middleware.js'

const epgRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', requireAuth)

  app.get('/', async (req) => {
    const data = await epg.getFullEpg(req.session!)
    return data
  })

  app.get('/channel/:epg_channel_id', async (req) => {
    const { epg_channel_id } = req.params as { epg_channel_id: string }
    const channel = await epg.getChannelEpg(req.session!, epg_channel_id)
    if (!channel) {
      return { name: epg_channel_id, programmes: [] }
    }
    return channel
  })
}

export default epgRoutes
export { epgRoutes }
