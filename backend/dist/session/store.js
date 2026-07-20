import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const sessions = new Map();
const DATA_DIR = join(import.meta.dirname, '..', '..');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 1000;
function scheduleSave() {
    if (saveTimer)
        return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        flushSave();
    }, SAVE_DEBOUNCE_MS);
}
function flushSave() {
    const data = [];
    for (const session of sessions.values()) {
        data.push({
            token: session.token,
            server: session.server,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            blockedServers: Array.from(session.blockedServers),
        });
    }
    try {
        writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch {
        // falha silenciosa — sessão continua em memória
    }
}
function loadFromDisk() {
    if (!existsSync(SESSIONS_FILE))
        return;
    try {
        const raw = readFileSync(SESSIONS_FILE, 'utf-8');
        const arr = JSON.parse(raw);
        const now = Date.now();
        for (const s of arr) {
            if (s.expiresAt <= now)
                continue;
            sessions.set(s.token, {
                token: s.token,
                server: s.server,
                createdAt: s.createdAt,
                expiresAt: s.expiresAt,
                blockedServers: new Set(s.blockedServers),
            });
        }
    }
    catch {
        // arquivo corrompido ou ausente — ignora
    }
}
loadFromDisk();
function cleanExpired() {
    const now = Date.now();
    let changed = false;
    for (const [token, session] of sessions) {
        if (session.expiresAt <= now) {
            sessions.delete(token);
            changed = true;
        }
    }
    if (changed)
        scheduleSave();
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
    scheduleSave();
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
        scheduleSave();
        return null;
    }
    return session;
}
export function destroySession(token) {
    sessions.delete(token);
    scheduleSave();
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
    scheduleSave();
}
//# sourceMappingURL=store.js.map