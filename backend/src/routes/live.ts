import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { sortCategories } from '../iptv/categoryOrder.js'
import * as catalog from '../iptv/catalog.js'
import { requireAuth } from './middleware.js'

interface StreamParams {
  stream_id: string
}

interface StreamsQuery {
  category_id?: string
}

const liveRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', requireAuth)

  app.get('/categories', async (req) => {
    const categories = await catalog.getLiveCategories(req.session!)
    return { categories: sortCategories(categories) }
  })

  app.get('/streams', async (req) => {
    const { category_id } = req.query as StreamsQuery
    if (category_id) {
      const streams = await catalog.getLiveStreams(req.session!, category_id)
      return { streams }
    }
    const categories = await catalog.getLiveCategories(req.session!)
    const allStreams: Awaited<ReturnType<typeof catalog.getLiveStreams>> = []
    const results = await Promise.allSettled(
      categories.map((c) => catalog.getLiveStreams(req.session!, c.category_id)),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') allStreams.push(...r.value)
    }
    return { streams: allStreams }
  })

  app.get('/short_epg/:stream_id', async (req) => {
    const { stream_id } = req.params as StreamParams
    return catalog.getShortEpg(req.session!, Number(stream_id))
  })
}

export default liveRoutes
export { liveRoutes }
