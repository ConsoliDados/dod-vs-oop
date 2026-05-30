import { describe, expect, it } from 'vitest'
import { type CursorPoint, decodeCursor, encodeCursor, InvalidCursorError } from './cursor'

/**
 * Cursor round-trip + invalid-input cases (FEAT-005 sad paths).
 *
 * The cursor is opaque base64 of `${postedAt.toISOString()}|${sequence}`. Any
 * malformed token must throw `InvalidCursorError` (→ 422 INVALID_CURSOR) at
 * the use-case boundary rather than silently returning the first page.
 */
describe('cursor codec', () => {
  describe('round-trip', () => {
    it('encode → decode preserves postedAt and sequence', () => {
      const point: CursorPoint = {
        postedAt: new Date('2026-05-29T12:34:56.789Z'),
        sequence: 42,
      }
      const decoded = decodeCursor(encodeCursor(point))
      expect(decoded.postedAt.toISOString()).toBe(point.postedAt.toISOString())
      expect(decoded.sequence).toBe(point.sequence)
    })

    it('handles sequence = 0 (the first posting)', () => {
      const point: CursorPoint = { postedAt: new Date('2026-01-01T00:00:00.000Z'), sequence: 0 }
      const decoded = decodeCursor(encodeCursor(point))
      expect(decoded.sequence).toBe(0)
    })

    it('handles very large sequences (within safe-integer range)', () => {
      const point: CursorPoint = { postedAt: new Date(), sequence: 9_000_000_000_000 }
      const decoded = decodeCursor(encodeCursor(point))
      expect(decoded.sequence).toBe(9_000_000_000_000)
    })
  })

  describe('invalid input throws InvalidCursorError', () => {
    it('rejects non-base64 garbage', () => {
      expect(() => decodeCursor('not-base64-!@#')).toThrow(InvalidCursorError)
    })

    it('rejects base64 without the `|` separator', () => {
      const noSep = Buffer.from('2026-05-29T12:34:56.789Z42', 'utf8').toString('base64')
      expect(() => decodeCursor(noSep)).toThrow(InvalidCursorError)
    })

    it('rejects an unparseable date in the payload', () => {
      const badDate = Buffer.from('not-a-date|10', 'utf8').toString('base64')
      expect(() => decodeCursor(badDate)).toThrow(InvalidCursorError)
    })

    it('rejects a negative sequence', () => {
      const negSeq = Buffer.from('2026-05-29T12:34:56.789Z|-1', 'utf8').toString('base64')
      expect(() => decodeCursor(negSeq)).toThrow(InvalidCursorError)
    })

    it('rejects a non-integer sequence', () => {
      const floatSeq = Buffer.from('2026-05-29T12:34:56.789Z|1.5', 'utf8').toString('base64')
      expect(() => decodeCursor(floatSeq)).toThrow(InvalidCursorError)
    })

    it('rejects a NaN sequence (non-numeric)', () => {
      const nanSeq = Buffer.from('2026-05-29T12:34:56.789Z|abc', 'utf8').toString('base64')
      expect(() => decodeCursor(nanSeq)).toThrow(InvalidCursorError)
    })

    it('rejects an empty cursor', () => {
      expect(() => decodeCursor('')).toThrow(InvalidCursorError)
    })

    it('the thrown error carries the offending cursor in its context (greppable)', () => {
      try {
        decodeCursor('bad-cursor!')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidCursorError)
        expect((err as InvalidCursorError).code).toBe('INVALID_CURSOR')
        expect((err as InvalidCursorError).details).toEqual({ cursor: 'bad-cursor!' })
      }
    })
  })
})
