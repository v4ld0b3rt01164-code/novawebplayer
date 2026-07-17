/**
 * Ordem de prioridade sugerida para categorias ao vivo.
 *
 * REGRA (AGENTS.md / PRD): as categorias vêm da API; esta lista serve apenas
 * para ordenar, nunca para filtrar ou fechar o conjunto.
 */
export const LIVE_CATEGORY_PRIORITY = [
    'ABERTOS',
    'ESPORTES',
    'NOTÍCIAS',
    'GLOBO SUDESTE',
    'GLOBO NORDESTE',
    'FILMES E SÉRIES',
    'DOCUMENTÁRIOS',
    'VARIEDADES',
];
const normalizedPriority = LIVE_CATEGORY_PRIORITY.map((c) => c.toLowerCase().trim());
export function sortCategories(categories) {
    return [...categories].sort((a, b) => {
        const ai = normalizedPriority.indexOf(a.category_name.toLowerCase().trim());
        const bi = normalizedPriority.indexOf(b.category_name.toLowerCase().trim());
        if (ai !== -1 && bi !== -1)
            return ai - bi;
        if (ai !== -1)
            return -1;
        if (bi !== -1)
            return 1;
        return a.category_name.localeCompare(b.category_name);
    });
}
//# sourceMappingURL=categoryOrder.js.map