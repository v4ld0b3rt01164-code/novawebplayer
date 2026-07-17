import { UpstreamHttpError } from './proxy.js';
import { reauthenticateSession } from './reauth.js';
const FALLBACK_STATUSES = new Set([401, 403]);
/**
 * Executa `operation()`. Se ela falhar com UpstreamHttpError 401/403,
 * re-autentica a sessão (trocando de domínio) e tenta `operation()` mais uma
 * única vez. Qualquer outro erro (rede, timeout, 5xx) propaga direto, sem
 * fallback — trocar de servidor não ajuda nesses casos.
 *
 * IMPORTANTE: `operation` deve ler `session.server` no momento em que é
 * chamada (não capturar a URL upstream antes de invocar este helper), para
 * que a segunda tentativa use o servidor novo. Ex: passe uma closure que
 * monta a URL upstream internamente.
 */
export async function withUpstreamFallback(session, operation) {
    try {
        return await operation();
    }
    catch (err) {
        if (err instanceof UpstreamHttpError && FALLBACK_STATUSES.has(err.status)) {
            console.warn(`[fallback] status ${err.status} do upstream — re-autenticando sessão ${session.token.slice(0, 8)}…`);
            await reauthenticateSession(session);
            return operation();
        }
        throw err;
    }
}
//# sourceMappingURL=withFallback.js.map