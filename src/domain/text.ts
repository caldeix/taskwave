/** Texto para comparar sin mayúsculas ni tildes: «Álgebra» → «algebra». */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** ¿Contiene `text` todas las palabras de `query` (sin mayúsculas ni tildes)? */
export function matchesWords(text: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const haystack = fold(text)
  return words.length > 0 && words.every((w) => haystack.includes(w))
}
