import type { Session } from '../session/store.js';
import type { ActiveServer } from './auth.js';
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
export declare function reauthenticateSession(session: Session): Promise<ActiveServer>;
//# sourceMappingURL=reauth.d.ts.map