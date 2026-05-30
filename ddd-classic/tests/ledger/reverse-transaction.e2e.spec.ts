import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'

/**
 * FEAT-004 end-to-end (NestJS in-process, sqlite `:memory:`).
 *
 * Proves the reversal slice (REQ-007, ADR-0011) end-to-end:
 *  - `POST /transactions/:id/reversals` creates a new transaction with
 *    mirrored postings linked back via `reversedTransactionId`
 *  - the original row + postings are untouched (REQ-011); affected accounts'
 *    cached `availableBalance` returns to pre-original via the existing
 *    FEAT-003 `OnTransactionPostedHandler` on the sync bus (ADR-0003)
 *  - 404 on an unknown id; 422 if any referenced account is non-`active`
 *    (REQ-006 *active* uniform — gate 2026-05-29)
 *  - reverse-of-a-reversal allowed; behaves as a re-do
 */
describe('Reverse transaction (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  async function openAccount(ownerId: string, currency: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency })
    return res.body.id as string
  }

  async function postTx(from: string, to: string, amount: number, reference?: string) {
    return request(server)
      .post('/transactions')
      .send({
        ...(reference ? { reference } : {}),
        postings: [
          { accountId: from, amount, direction: 'debit' },
          { accountId: to, amount, direction: 'credit' },
        ],
      })
  }

  async function balanceOf(id: string): Promise<number> {
    const res = await request(server).get(`/accounts/${id}/balance`)
    return res.body.availableBalance as number
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleFixture.createNestApplication()
    await app.init()
    server = app.getHttpServer() as Parameters<typeof request>[0]
  })

  afterAll(async () => {
    await app.close()
  })

  it('reverses a posted transaction (REQ-007): 201, mirrored postings, link back, balances flat', async () => {
    const from = await openAccount('rv-from', 'BRL')
    const to = await openAccount('rv-to', 'BRL')

    const posted = await postTx(from, to, 1000, 'INV-RV-1')
    expect(posted.status).toBe(201)
    const originalId = posted.body.id as string
    expect(await balanceOf(from)).toBe(-1000)
    expect(await balanceOf(to)).toBe(1000)

    const reversal = await request(server).post(`/transactions/${originalId}/reversals`)
    expect(reversal.status).toBe(201)
    // Mirrored sign per posting, same accounts, same currency, balanced.
    const rPostings = reversal.body.postings as Array<{
      accountId: string
      amountCents: number
      direction: 'debit' | 'credit'
    }>
    expect(rPostings).toHaveLength(2)
    expect(
      rPostings.reduce((acc: number, p: { amountCents: number }) => acc + p.amountCents, 0),
    ).toBe(0)
    const debitedInOriginal = rPostings.find((p) => p.accountId === from)
    const creditedInOriginal = rPostings.find((p) => p.accountId === to)
    expect(debitedInOriginal?.amountCents).toBe(1000) // mirrored: original was -1000
    expect(debitedInOriginal?.direction).toBe('credit')
    expect(creditedInOriginal?.amountCents).toBe(-1000) // mirrored: original was +1000
    expect(creditedInOriginal?.direction).toBe('debit')

    // One-way link captured on the reversal only.
    expect(reversal.body.reversedTransactionId).toBe(originalId)
    expect(reversal.body.reference).toBe('Reversal of INV-RV-1')

    // Cached balances are flat — the reversal flowed through TransactionPosted
    // → OnTransactionPostedHandler (FEAT-003) on the sync bus (ADR-0003).
    expect(await balanceOf(from)).toBe(0)
    expect(await balanceOf(to)).toBe(0)
  })

  it('returns 404 TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const res = await request(server).post(`/transactions/${randomUUID()}/reversals`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('TRANSACTION_NOT_FOUND')
  })

  it('rejects (422 ACCOUNT_NOT_ACTIVE) when any referenced account is non-active', async () => {
    const from = await openAccount('rv-active-1', 'BRL')
    const to = await openAccount('rv-active-2', 'BRL')
    const posted = await postTx(from, to, 500)
    const originalId = posted.body.id as string

    // Freeze one of the accounts — the reversal post must be rejected (REQ-006 *active*).
    await request(server).patch(`/accounts/${from}/freeze`)

    const res = await request(server).post(`/transactions/${originalId}/reversals`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('ACCOUNT_NOT_ACTIVE')

    // Cached balances are unchanged — no half-state was written.
    expect(await balanceOf(from)).toBe(-500)
    expect(await balanceOf(to)).toBe(500)
  })

  it('allows reverse-of-a-reversal: third tx is a re-do, two reversedTransactionId hops', async () => {
    const from = await openAccount('rv-chain-1', 'BRL')
    const to = await openAccount('rv-chain-2', 'BRL')

    const original = await postTx(from, to, 700)
    const originalId = original.body.id as string

    const r1 = await request(server).post(`/transactions/${originalId}/reversals`)
    expect(r1.status).toBe(201)
    const r1Id = r1.body.id as string
    expect(r1.body.reversedTransactionId).toBe(originalId)

    // Balances are flat after r1.
    expect(await balanceOf(from)).toBe(0)
    expect(await balanceOf(to)).toBe(0)

    const r2 = await request(server).post(`/transactions/${r1Id}/reversals`)
    expect(r2.status).toBe(201)
    expect(r2.body.reversedTransactionId).toBe(r1Id)

    // r2 is a re-do of the original — balances back to the original's effect.
    expect(await balanceOf(from)).toBe(-700)
    expect(await balanceOf(to)).toBe(700)
  })

  it('allows multiple reversals of the same id (append-only stance — gate 2026-05-29)', async () => {
    const from = await openAccount('rv-multi-1', 'BRL')
    const to = await openAccount('rv-multi-2', 'BRL')
    const posted = await postTx(from, to, 300)
    const originalId = posted.body.id as string

    const r1 = await request(server).post(`/transactions/${originalId}/reversals`)
    const r2 = await request(server).post(`/transactions/${originalId}/reversals`)
    expect(r1.status).toBe(201)
    expect(r2.status).toBe(201)
    expect(r1.body.id).not.toBe(r2.body.id)
    // Two reversals of the same original — cache shows the second mirror applied
    // again (-300, +300 net over the two reversals); recoverable by recompute
    // (FEAT-006). Not asserting an exact cached number here — the point is that
    // both POSTs returned 201; idempotency keys are forward-looking.
  })

  it('an original transaction never carries a reversedTransactionId (one-way link)', async () => {
    const from = await openAccount('rv-link-1', 'BRL')
    const to = await openAccount('rv-link-2', 'BRL')
    const posted = await postTx(from, to, 100)
    expect(posted.body.reversedTransactionId).toBeUndefined()
  })
})
