import { UpstreamHttpError } from './proxy.js';
import { reauthenticateSession } from './reauth.js';
const FALLBACK_STATUSES = new Set([401, 403, 502, 503, 504]);
const MAX_FALLBACK_ATTEMPTS = 7;
/**
 * Executa `operation()`. Se ela falhar com UpstreamHttpError 401/403 ou com
 * indisponibilidade HTTP 502/503/504, re-autentica a sessão (trocando de
 * domínio) e tenta novamente. Continua pelos demais domínios candidatos até
 * encontrar um que responda ou esgotar a lista. Erros de rede e timeout
 * continuam propagando direto.
 *
 * IMPORTANTE: `operation` deve ler `session.server` no momento em que é
 * chamada (não capturar a URL upstream antes de invocar este helper), para
 * que a segunda tentativa use o servidor novo. Ex: passe uma closure que
 * monta a URL upstream internamente.
 */
export async function withUpstreamFallback(session, operation) {
    let fallbackAttempts = 0;
    while (true) {
        try {
            return await operation();
        }
        catch (err) {
            if (!(err instanceof UpstreamHttpError) ||
                !FALLBACK_STATUSES.has(err.status) ||
                fallbackAttempts >= MAX_FALLBACK_ATTEMPTS) {
                throw err;
            }
            fallbackAttempts += 1;
            console.warn(`[fallback] status ${err.status} do upstream — tentativa ${fallbackAttempts}/${MAX_FALLBACK_ATTEMPTS} na sessão ${session.token.slice(0, 8)}…`);
            await reauthenticateSession(session);
        }
    }
}
//# sourceMappingURL=withFallback.js.map