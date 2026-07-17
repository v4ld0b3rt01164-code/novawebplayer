import type { ActiveServer } from '../iptv/auth.js';
export interface Session {
    token: string;
    server: ActiveServer;
    createdAt: number;
    expiresAt: number;
    blockedServers: Set<string>;
}
export declare function createSession(server: ActiveServer): string;
export declare function getSession(token: string | undefined): Session | null;
export declare function destroySession(token: string): void;
/**
 * Atualiza o servidor ativo de uma sessão existente (usado pelo fallback de
 * stream). Muta o objeto em memória — qualquer referência já obtida via
 * getSession() (ex: req.session) passa a enxergar o novo servidor.
 */
export declare function updateSessionServer(token: string, server: ActiveServer): void;
//# sourceMappingURL=store.d.ts.map