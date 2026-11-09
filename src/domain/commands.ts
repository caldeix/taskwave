import { fold } from './text'

/**
 * Paleta de comandos (plan TASKWAVE-02, idea 3, D-4), como el «.» de Jira: lista de acciones de
 * la tarea que se filtra al escribir, sin tildes ni mayúsculas. Lógica pura: la paleta solo pinta.
 */
export interface Command {
  id: string
  /** Grupo en el que sale («Estado», «Prioridad»…); también se busca por él. */
  group: string
  label: string
  /** Palabras extra para encontrarlo (sinónimos). */
  keywords?: string
  disabled?: boolean
  run: () => void | Promise<void>
}

/**
 * Comandos que coinciden con lo escrito: cada palabra tiene que estar en el grupo, la etiqueta o
 * las palabras extra. Primero los que empiezan por lo escrito; si no se escribe nada, todos.
 */
export function filterCommands(commands: Command[], text: string): Command[] {
  const words = fold(text).split(/\s+/).filter(Boolean)
  const enabled = commands.filter((c) => !c.disabled)
  if (!words.length) return enabled
  const scored = enabled
    .map((c) => {
      const label = fold(c.label)
      const haystack = `${fold(c.group)} ${label} ${fold(c.keywords ?? '')}`
      const hit = words.every((w) => haystack.includes(w))
      return { c, hit, starts: label.startsWith(words[0]!) }
    })
    .filter((s) => s.hit)
  // `sort` es estable: dentro de cada bloque se mantiene el orden original.
  scored.sort((a, b) => Number(b.starts) - Number(a.starts))
  return scored.map((s) => s.c)
}
