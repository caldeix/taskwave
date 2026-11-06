/**
 * Comentarios de una tarea (`users/{uid}/tasks/{id}/comments/{cid}`, step-18). El texto es
 * markdown (D-43). `createdAt` y `editedAt` los pone el servidor; un comentario editado lleva
 * la marca «editado» con su fecha.
 */

/** Límite de las reglas de Firestore. */
export const MAX_COMMENT = 10000

export interface Comment {
  id: string
  body: string
  createdAtMs: number | null
  editedAtMs: number | null
}

function millis(value: unknown): number | null {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : null
}

export function commentFromData(id: string, data: Record<string, unknown>): Comment {
  return {
    id,
    body: String(data.body ?? ''),
    createdAtMs: millis(data.createdAt),
    editedAtMs: millis(data.editedAt),
  }
}

/** Texto que se guarda: sin espacios ni saltos de línea al final. */
export function normalizeCommentBody(body: string): string {
  return body.replace(/\s+$/, '')
}

export type CommentError = 'required' | 'tooLong'

export function validateComment(body: string): CommentError | null {
  const normalized = normalizeCommentBody(body)
  if (!normalized.trim()) return 'required'
  if (normalized.length > MAX_COMMENT) return 'tooLong'
  return null
}
