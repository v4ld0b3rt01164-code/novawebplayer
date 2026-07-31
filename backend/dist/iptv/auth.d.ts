import type { XtreamAuthResponse } from './types.js';
export interface ActiveServer {
    baseUrl: string;
    username: string;
    password: string;
}
/**
 * Embaralha e percorre os domínios candidatos até um autenticar com sucesso.
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