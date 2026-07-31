import { IPTV_CANDIDATES, } from './servers.js';
const AUTH_TIMEOUT_MS = 5000;
const PLAYER_API_PATH = '/player_api.php';
/**
 * Tenta autenticar em um único domínio Xtream Codes.
 *
 * Sucesso: HTTP 200 + user_info.auth === 1.
 * Nunca loga/retorna as credenciais brutas.
 */
async function tryAuthenticate(baseUrl, username, password) {
    const url = new URL(PLAYER_API_PATH, baseUrl);
    url.searchParams.set('username', username);
    url.searchParams.set('password', password);
    let res;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
        res = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timer);
    }
    catch {
        return null;
    }
    if (!res.ok)
        return null;
    let payload;
    try {
        payload = await res.json();
    }
    catch {
        return null;
    }
    if (payload &&
        typeof payload === 'object' &&
        'user_info' in payload &&
        payload.user_info?.auth === 1) {
        return payload;
    }
    return null;
}
/**
 * Embaralha um array em-place (Fisher-Yates) e devolve a mesma referência.
 * Garante ordem aleatória sem viés para a tentativa de login/fallback.
 */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}
/**
 * Percorre a lista de domínios candidatos (em ordem aleatória por chamada)
 * até um autenticar com sucesso. A randomização faz com que cada login tente
 * um servidor diferente primeiro, distribuindo carga e evitando travar sempre
 * no mesmo domínio quando há instabilidade.
 *
 * @param excludeBaseUrls domínios a pular (ex: sabidamente bloqueados nesta
 * sessão). Usado pelo fallback em nível de stream; login normal não passa nada.
 * @throws Error quando todos os domínios (não excluídos) falham, ou quando a
 * exclusão elimina todos os candidatos.
 */
export async function authenticate(username, password, excludeBaseUrls = new Set()) {
    const candidates = shuffle(IPTV_CANDIDATES.filter((baseUrl) => !excludeBaseUrls.has(baseUrl)));
    if (candidates.length === 0) {
        throw new Error('Todos os servidores candidatos estão bloqueados nesta sessão.');
    }
    for (const baseUrl of candidates) {
        const response = await tryAuthenticate(baseUrl, username, password);
        if (response) {
            return {
                response,
                server: { baseUrl, username, password },
            };
        }
    }
    throw new Error('Não foi possível conectar a nenhum servidor. Verifique usuário/senha ou tente novamente mais tarde.');
}
//# sourceMappingURL=auth.js.map