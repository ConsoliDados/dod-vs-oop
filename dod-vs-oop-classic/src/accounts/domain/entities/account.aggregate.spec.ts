import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { InvalidEntityError, InvalidValueObjectError } from '../../../core/errors'
import { type Currency, Money } from '../../../shared/value-objects'
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
        lastPostedSeq: 7,
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
      expect(account.getLastPostedSeq()).toBe(7)
      expect(account.getDomainEvents()).toHaveLength(0)
    })
  })

  describe('status transitions (FEAT-007)', () => {
    describe('freeze', () => {
      it('moves active → frozen, bumps version', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')

        account.freeze()

        expect(account.getStatus()).toBe('frozen')
        expect(account.getVersion()).toBe(1)
      })

      it('THROWS InvalidEntityError when freezing a frozen account', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')
        account.freeze()

        expect(() => account.freeze()).toThrow(InvalidEntityError)
      })

      it('THROWS InvalidEntityError when freezing a closed account', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')
        account.close()

        expect(() => account.freeze()).toThrow(InvalidEntityError)
      })
    })

    describe('activate', () => {
      it('moves frozen → active, bumps version', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')
        account.freeze()

        account.activate()

        expect(account.getStatus()).toBe('active')
        expect(account.getVersion()).toBe(2)
      })

      it('THROWS InvalidEntityError when activating an active account', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')

        expect(() => account.activate()).toThrow(InvalidEntityError)
      })

      it('THROWS InvalidEntityError when activating a closed account (terminal)', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')
        account.close()

        expect(() => account.activate()).toThrow(InvalidEntityError)
      })
    })

    describe('close', () => {
      it('moves active → closed, bumps version', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')

        account.close()

        expect(account.getStatus()).toBe('closed')
        expect(account.getVersion()).toBe(1)
      })

      it('moves frozen → closed, bumps version', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')
        account.freeze()

        account.close()

        expect(account.getStatus()).toBe('closed')
        expect(account.getVersion()).toBe(2)
      })

      it('THROWS InvalidEntityError when closing a closed account (terminal)', () => {
        const account = AccountAggregate.create('owner-1', 'BRL')
        account.close()

        expect(() => account.close()).toThrow(InvalidEntityError)
      })
    })
  })

  describe('reflectPosting', () => {
    it('applies a signed delta and advances the checkpoint, bumping version', () => {
      const account = AccountAggregate.create('owner-1', 'BRL')

      account.reflectPosting(Money.fromCents(2500, 'BRL'), 10)
      expect(account.getAvailableBalance().getCents()).toBe(2500)
      expect(account.getLastPostedSeq()).toBe(10)
      expect(account.getVersion()).toBe(1)

      account.reflectPosting(Money.fromCents(-1000, 'BRL'), 14)
      expect(account.getAvailableBalance().getCents()).toBe(1500)
      expect(account.getLastPostedSeq()).toBe(14)
      expect(account.getVersion()).toBe(2)
    })

    it('THROWS InvalidEntityError on a non-monotonic throughSeq', () => {
      const account = AccountAggregate.create('owner-1', 'BRL')
      account.reflectPosting(Money.fromCents(1000, 'BRL'), 5)

      expect(() => account.reflectPosting(Money.fromCents(1000, 'BRL'), 5)).toThrow(
        InvalidEntityError,
      )
      expect(() => account.reflectPosting(Money.fromCents(1000, 'BRL'), 4)).toThrow(
        InvalidEntityError,
      )
    })

    it('THROWS InvalidEntityError on a currency mismatch', () => {
      const account = AccountAggregate.create('owner-1', 'BRL')
      expect(() => account.reflectPosting(Money.fromCents(1000, 'USD'), 1)).toThrow(
        InvalidEntityError,
      )
    })
  })
})
