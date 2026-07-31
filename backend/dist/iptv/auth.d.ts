import type { XtreamAuthResponse } from './types.js';
export interface ActiveServer {
    baseUrl: string;
    username: string;
    password: string;
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
export declare function authenticate(username: string, password: string, excludeBaseUrls?: ReadonlySet<string>): Promise<{
    response: XtreamAuthResponse;
    server: ActiveServer;
}>;
//# sourceMappingURL=auth.d.ts.map