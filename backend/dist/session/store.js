import { randomUUID } from 'node:crypto';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const sessions = new Map();
function cleanExpired() {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (session.expiresAt <= now)
            sessions.delete(token);
    }
}
export function createSession(server) {
    cleanExpired();
    const token = randomUUID();
    const now = Date.now();
    sessions.set(token, {
        token,
        server,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
        blockedServers: new Set(),
    });
    return token;
}
export function getSession(token) {
    if (!token)
        return null;
    const session = sessions.get(token);
    if (!session)
        return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return session;
}
export function destroySession(token) {
    sessions.delete(token);
}
/**
 * Atualiza o servidor ativo de uma sessão existente (usado pelo fallback de
 * stream). Muta o objeto em memória — qualquer referência já obtida via
 * getSession() (ex: req.session) passa a enxergar o novo servidor.
 */
export function updateSessionServer(token, server) {
    const session = sessions.get(token);
    if (!session)
        return;
    session.server = server;
}
//# sourceMappingURL=store.js.map