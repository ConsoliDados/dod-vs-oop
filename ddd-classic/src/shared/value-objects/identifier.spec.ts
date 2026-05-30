import { describe, expect, it } from 'vitest'
import { InvalidIdentifierError } from '../../core/errors'
import { Identifier } from './identifier'

/**
 * Smoke tests for Identifier (UUID Value Object).
 *
 * Validates the throw-based override (no Result):
 * - Smart Constructor (`create`) returns a valid instance directly.
 * - `buildExisting` throws `InvalidIdentifierError` on malformed UUID.
 * - Equality compares by value.
 */
describe('Identifier (VO + Validator)', () => {
  it('creates a fresh UUID via create()', () => {
    const id = Identifier.create()
    expect(id.getValue()).toMatch(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    )
  })

  it('rebuilds a valid UUID via buildExisting()', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const id = Identifier.buildExisting(uuid)
    expect(id.getValue()).toBe(uuid)
  })

  it('THROWS InvalidIdentifierError on malformed UUID', () => {
    expect(() => Identifier.buildExisting('not-a-uuid')).toThrow(InvalidIdentifierError)
  })

  it('THROWS InvalidIdentifierError on empty string', () => {
    expect(() => Identifier.buildExisting('')).toThrow(InvalidIdentifierError)
  })

  it('isEqual returns true for same value', () => {
    const a = Identifier.buildExisting('550e8400-e29b-41d4-a716-446655440000')
    const b = Identifier.buildExisting('550e8400-e29b-41d4-a716-446655440000')
    expect(a.isEqual(b)).toBe(true)
  })
})
