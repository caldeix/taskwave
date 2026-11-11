/**
 * Búsqueda de versiones nuevas de la PWA (v1.3.2). El navegador solo mira si hay un service worker
 * nuevo al cargar la página, así que una pestaña abierta todo el día (o la app instalada) no se
 * entera. La app lo pide al volver a la pestaña, como mucho una vez cada `UPDATE_CHECK_GAP_MS`.
 */
export const UPDATE_CHECK_GAP_MS = 5 * 60 * 1000

/** ¿Toca buscar una versión nueva? Solo si la pestaña se ve, hay conexión y ha pasado el margen. */
export function shouldCheckForUpdate(
  lastCheckMs: number | null,
  nowMs: number,
  state: { visible: boolean; online: boolean },
): boolean {
  if (!state.visible || !state.online) return false
  return lastCheckMs === null || nowMs - lastCheckMs >= UPDATE_CHECK_GAP_MS
}
