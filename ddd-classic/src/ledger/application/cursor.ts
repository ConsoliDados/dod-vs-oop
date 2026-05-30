import { UseCaseError } from '../../core/use-cases/use-case'

/**
 * Cursor over `(postedAt, sequence)` — the deterministic order used by
 * `ListPostingsUseCase` (FEAT-005). Opaque to clients: base64 of
 * `${postedAt.toISOString()}|${sequence}`. Round-trip-safe; decoding throws
 * `InvalidCursorError` (→ 422) on a malformed token rather than silently
 * returning the first page.
 */

export class InvalidCursorError extends UseCaseError {
  constructor(cursor: string) {
    super(`Invalid cursor: ${cursor}`, 'INVALID_CURSOR', { cursor })
    this.name = 'InvalidCursorError'
    Object.setPrototypeOf(this, InvalidCursorError.prototype)
  }
}

export interface CursorPoint {
  postedAt: Date
  sequence: number
}

export function encodeCursor(point: CursorPoint): string {
  const raw = `${point.postedAt.toISOString()}|${point.sequence}`
  return Buffer.from(raw, 'utf8').toString('base64')
}

export function decodeCursor(token: string): CursorPoint {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8')
    const sep = raw.lastIndexOf('|')
    if (sep < 0) throw new InvalidCursorError(token)
    const postedAtIso = raw.slice(0, sep)
    const sequenceStr = raw.slice(sep + 1)
    const postedAt = new Date(postedAtIso)
    const sequence = Number(sequenceStr)
    if (Number.isNaN(postedAt.getTime())) throw new InvalidCursorError(token)
    if (!Number.isInteger(sequence) || sequence < 0) throw new InvalidCursorError(token)
    return { postedAt, sequence }
  } catch (cause) {
    if (cause instanceof InvalidCursorError) throw cause
    throw new InvalidCursorError(token)
  }
}
