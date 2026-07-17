/**
 * Ordem de prioridade sugerida para categorias ao vivo.
 *
 * REGRA (AGENTS.md / PRD): as categorias vêm da API; esta lista serve apenas
 * para ordenar, nunca para filtrar ou fechar o conjunto.
 */
export declare const LIVE_CATEGORY_PRIORITY: string[];
export declare function sortCategories<T extends {
    category_name: string;
}>(categories: T[]): T[];
//# sourceMappingURL=categoryOrder.d.ts.map