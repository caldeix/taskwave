import { ref, type Ref } from 'vue'

export interface Tip {
  x: number
  y: number
  /** Valor (lo importante, en negrita) y a qué se refiere. */
  value: string
  label: string
}

/**
 * Aviso flotante de los gráficos (step-23): cada barra o casilla lo muestra al pasar el ratón
 * o al llegar con el teclado. Nunca es la única forma de ver un dato (cada gráfico tiene su
 * tabla). La posición es relativa al contenedor del gráfico.
 */
export function useChartTooltip(container: Ref<HTMLElement | null>) {
  const tip = ref<Tip | null>(null)

  function place(x: number, y: number, value: string, label: string): void {
    const box = container.value?.getBoundingClientRect()
    if (!box) return
    tip.value = { x: x - box.left, y: y - box.top, value, label }
  }

  /** Manejadores para una marca: ratón, foco y salida. */
  function on(value: string, label: string) {
    return {
      onPointerenter: (e: PointerEvent) => place(e.clientX, e.clientY, value, label),
      onPointermove: (e: PointerEvent) => place(e.clientX, e.clientY, value, label),
      onPointerleave: () => (tip.value = null),
      onFocus: (e: FocusEvent) => {
        const r = (e.target as HTMLElement).getBoundingClientRect()
        place(r.left + r.width / 2, r.top, value, label)
      },
      onBlur: () => (tip.value = null),
    }
  }

  return { tip, on }
}
