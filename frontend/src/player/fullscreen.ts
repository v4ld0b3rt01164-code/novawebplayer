/**
 * Helpers de fullscreen estritamente para iOS Safari/Chrome.
 *
 * O <video> em iOS precisa do webkitEnterFullscreen() para ocupar a tela
 * inteira; do contrario, fica limitado ao container CSS. Android e desktop
 * NAO devem ser afetados por este modulo: as funcoes abaixo fazem no-op
 * fora do iOS e o botao de maximizar nas telas so as chama quando
 * detectIosWebKit() for true.
 */

function isIosWebKit(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isApple = /iPhone|iPad|iPod/i.test(ua)
  if (!isApple) return false
  // Chrome no iOS usa o motor WebKit do Safari, entao o mesmo caminho se aplica.
  return /WebKit| CriOS/i.test(ua)
}

/**
 * Solicita fullscreen nativo em um <video>. No-op se o navegador nao for
 * iOS Safari/Chrome ou se o metodo webkit nao estiver disponivel.
 */
export function enterIosFullscreen(videoEl: HTMLVideoElement | null): void {
  if (!isIosWebKit()) return
  if (!videoEl) return
  const el = videoEl as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void
  }
  try {
    el.webkitEnterFullscreen?.()
  } catch {
    // ignora: webkitEnterFullscreen pode lancar em algumas paginas
  }
}
