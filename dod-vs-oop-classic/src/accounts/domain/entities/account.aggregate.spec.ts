import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidEntityError, InvalidValueObjectError } from '../../../core/errors'
import type { Currency } from '../../../shared/value-objects'
import { AccountOpenedEvent } from '../events/account-opened.event'
import { AccountAggregate, type AccountSnapshot } from './account.aggregate'

describe('AccountAggregate', () => {
  describe('create', () => {
    it('opens an active, zero-balance account and emits AccountOpened', () => {
      const account = AccountAggregate.create('owner-1', 'BRL')

      expect(account.getOwnerId()).toBe('owner-1')
      expect(account.getCurrency()).toBe('BRL')
      expect(account.getStatus()).toBe('active')
      expect(account.getAvailableBalance().getCents()).toBe(0)
      expect(account.getHoldAmount().getCents()).toBe(0)
      expect(account.getVersion()).toBe(0)
      expect(account.getId().getValue()).toMatch(/^[0-9a-f-]{36}$/)

      const events = account.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(AccountOpenedEvent)
      expect(events[0]?.eventType).toBe('AccountOpened')
    })

    it('THROWS InvalidEntityError on an empty ownerId', () => {
      expect(() => AccountAggregate.create('', 'BRL')).toThrow(InvalidEntityError)
    })

    it('THROWS InvalidEntityError on a whitespace-only ownerId', () => {
      expect(() => AccountAggregate.create('   ', 'BRL')).toThrow(InvalidEntityError)
    })

    it('THROWS InvalidValueObjectError on an unsupported currency', () => {
      expect(() => AccountAggregate.create('owner-1', 'XYZ' as unknown as Currency)).toThrow(
        InvalidValueObjectError,
      )
    })
  })

  describe('buildExisting', () => {
    it('round-trips a persisted snapshot without emitting events', () => {
      const snapshot: AccountSnapshot = {
        id: randomUUID(),
        ownerId: 'owner-9',
        currency: 'USD',
        status: 'active',
        availableBalanceCents: 12345,
        holdAmountCents: 100,
        version: 3,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }

      const account = AccountAggregate.buildExisting(snapshot)

      expect(account.getId().getValue()).toBe(snapshot.id)
      expect(account.getOwnerId()).toBe('owner-9')
      expect(account.getCurrency()).toBe('USD')
      expect(account.getAvailableBalance().getCents()).toBe(12345)
      expect(account.getHoldAmount().getCents()).toBe(100)
      expect(account.getVersion()).toBe(3)
      expect(account.getDomainEvents()).toHaveLength(0)
    })
  })
})
