import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../iptv/auth.js'
import { createSession } from '../session/store.js'

interface AuthBody {
  username?: string
  password?: string
}

const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post(
    '/auth',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (req: FastifyRequest<{ Body: AuthBody }>, reply: FastifyReply) => {
      const { username, password } = req.body ?? {}

      if (!username || !password) {
        return reply.status(400).send({
          error: 'Informe usuário e senha.',
        })
      }

      try {
        const { response, server } = await authenticate(username, password)
        const token = createSession(server)

        return reply.send({
          token,
          user_info: response.user_info,
        })
      } catch {
        // Credenciais nunca passam para mensagens de erro
        return reply.status(401).send({
          error:
            'Não foi possível conectar a nenhum servidor. Verifique usuário/senha ou tente novamente mais tarde.',
        })
      }
    },
  )
}

export default authRoutes
export { authRoutes }
