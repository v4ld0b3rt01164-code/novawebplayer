import type { Session } from '../session/store.js';
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
export declare function withUpstreamFallback<T>(session: Session, operation: () => Promise<T>): Promise<T>;
//# sourceMappingURL=withFallback.d.ts.map