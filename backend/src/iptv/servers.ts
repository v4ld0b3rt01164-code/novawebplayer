/**
 * Lista ordenada de domínios candidatos para fallback.
 *
 * REGRA (AGENTS.md / PRD): única fonte de verdade dos domínios; deve ficar
 * no backend e nunca ser exposta ao frontend.
 */
export const IPTV_CANDIDATES = [
  'http://liderpremium.xyz',
  'http://lidertv.xyz',
  'http://pipocashowp.com',
  'http://doubtzh.com',
  'http://poptour.xyz',
  'http://popcornplay.xyz',
  'http://hxqab.xyz',
  'http://aqphx.xyz',
] as const
