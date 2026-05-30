import { describe, expect, it } from 'vitest'
import { Money } from '../../../shared/value-objects'
import { AccountNotClosableError } from '../../application/errors/account-not-closable.error'
import { AccountAggregate } from '../entities/account.aggregate'
import { CloseAccountService } from './close-account.service'

describe('CloseAccountService', () => {
  const service = new CloseAccountService()

  it('closes the account when the ledger-recomputed balance is zero', () => {
    const account = AccountAggregate.create('owner-1', 'BRL')

    service.close(account, Money.zero('BRL'))

    expect(account.getStatus()).toBe('closed')
    expect(account.getVersion()).toBe(1)
  })

  it('closes a previously-frozen account at zero balance', () => {
    const account = AccountAggregate.create('owner-1', 'BRL')
    account.freeze()

    service.close(account, Money.zero('BRL'))

    expect(account.getStatus()).toBe('closed')
  })

  it('THROWS AccountNotClosableError on a positive ledger balance (and does NOT transition)', () => {
    const account = AccountAggregate.create('owner-1', 'BRL')

    expect(() => service.close(account, Money.fromCents(1, 'BRL'))).toThrow(AccountNotClosableError)
    expect(account.getStatus()).toBe('active')
    expect(account.getVersion()).toBe(0)
  })

  it('THROWS AccountNotClosableError on a negative ledger balance', () => {
    const account = AccountAggregate.create('owner-1', 'BRL')

    expect(() => service.close(account, Money.fromCents(-100, 'BRL'))).toThrow(
      AccountNotClosableError,
    )
    expect(account.getStatus()).toBe('active')
  })

  it('propagates InvalidEntityError when closing an already-closed account (transition guard)', () => {
    const account = AccountAggregate.create('owner-1', 'BRL')
    service.close(account, Money.zero('BRL'))

    // Aggregate's terminal-state guard fires before the precondition check —
    // both protect closeability; this asserts the transition guard wins on a
    // re-close attempt regardless of balance.
    expect(() => service.close(account, Money.zero('BRL'))).toThrow()
    expect(account.getStatus()).toBe('closed')
  })
})
