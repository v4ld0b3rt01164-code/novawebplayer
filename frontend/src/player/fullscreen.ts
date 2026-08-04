/**
 * Helpers de fullscreen estritamente para iOS Safari/Chrome.
 *
 * O <video> em iOS precisa do webkitEnterFullscreen() para ocupar a tela
 * inteira; do contrario, fica limitado ao container CSS. Android e desktop
 * NAO devem ser afetados por este modulo: canUseIosNativeFullscreen()
 * retorna false fora do iOS e os botoes de maximizar seguem o caminho do
 * layout maximizado via CSS.
 */

interface WebKitFullscreenVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void
}

function isIosWebKit(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isApple = /iPhone|iPad|iPod/i.test(ua)
  if (!isApple) return false
  // Chrome no iOS usa o motor WebKit do Safari, entao o mesmo caminho se aplica.
  return /WebKit| CriOS/i.test(ua)
}

/**
 * Diz se da para entrar no fullscreen nativo iOS agora: precisa ser iOS
 * WebKit e o <video> precisa expor webkitEnterFullscreen(). Os botoes de
 * maximizar usam isso para decidir entre fullscreen nativo (iOS) e o
 * layout maximizado via CSS (Android/desktop/fallback).
 */
export function canUseIosNativeFullscreen(
  videoEl: HTMLVideoElement | null,
): boolean {
  if (!isIosWebKit()) return false
  if (!videoEl) return false
  return (
    typeof (videoEl as WebKitFullscreenVideoElement).webkitEnterFullscreen ===
    'function'
  )
}

/**
 * Solicita fullscreen nativo em um <video>. No-op se o navegador nao for
 * iOS Safari/Chrome ou se o metodo webkit nao estiver disponivel.
 */
export function enterIosFullscreen(videoEl: HTMLVideoElement | null): void {
  if (!canUseIosNativeFullscreen(videoEl)) return
  try {
    ;(videoEl as WebKitFullscreenVideoElement).webkitEnterFullscreen?.()
  } catch {
    // ignora: webkitEnterFullscreen pode lancar em algumas paginas
  }
}
