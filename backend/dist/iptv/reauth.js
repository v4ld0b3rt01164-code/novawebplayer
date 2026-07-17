import { authenticate } from './auth.js';
import { updateSessionServer } from '../session/store.js';
/**
 * Re-autenticações em andamento, por token de sessão. Evita que múltiplas
 * requisições de segmento concorrentes (o player pode pedir vários .ts quase
 * ao mesmo tempo) disparem re-autenticações duplicadas quando o servidor
 * upstream começa a bloquear.
 */
const inFlightReauths = new Map();
/**
 * Re-autentica a sessão pulando o domínio atualmente em uso (e quaisquer
 * outros já marcados como bloqueados nesta sessão), e atualiza o servidor
 * ativo da sessão em caso de sucesso.
 *
 * Concorrência: se já houver uma re-autenticação em andamento para o mesmo
 * token, retorna a mesma Promise em vez de iniciar uma nova.
 *
 * @throws Error se todos os domínios candidatos estiverem bloqueados ou
 * falharem a autenticação. Nesse caso, a lista de bloqueados da sessão é
 * limpa, para que uma tentativa futura tenha uma nova chance (o bloqueio do
 * upstream pode ser temporário).
 */
export async function reauthenticateSession(session) {
    const existing = inFlightReauths.get(session.token);
    if (existing)
        return existing;
    const attempt = (async () => {
        session.blockedServers.add(session.server.baseUrl);
        try {
            const { server } = await authenticate(session.server.username, session.server.password, session.blockedServers);
            updateSessionServer(session.token, server);
            console.log(`[reauth] sessão ${session.token.slice(0, 8)}… migrada para novo servidor upstream`);
            return server;
        }
        catch (err) {
            // Esgotamos os candidatos (ou todos falharam). Zera o bloqueio para dar
            // uma nova chance na próxima tentativa — o bloqueio pode ser temporário.
            session.blockedServers.clear();
            throw err;
        }
        finally {
            inFlightReauths.delete(session.token);
        }
    })();
    inFlightReauths.set(session.token, attempt);
    return attempt;
}
//# sourceMappingURL=reauth.js.map