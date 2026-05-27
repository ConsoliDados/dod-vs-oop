import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'

/**
 * FEAT-003 end-to-end (NestJS in-process, sqlite `:memory:`).
 *
 * Proves the cross-context loop (REQ-003): posting a balanced transaction makes
 * `accounts` fold the signed effects into each account's cached `availableBalance`
 * via the `TransactionPosted` handler on the synchronous in-memory bus (ADR-0003).
 * Checkpoint monotonicity is covered by the aggregate unit spec.
 */
describe('Reflect balance on posting (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  async function openAccount(ownerId: string, currency: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency })
    return res.body.id as string
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

  it('folds a posted transaction into the affected balances (REQ-003)', async () => {
    const from = await openAccount('owner-from', 'BRL')
    const to = await openAccount('owner-to', 'BRL')
    const bystander = await openAccount('owner-bystander', 'BRL')

    expect(await balanceOf(from)).toBe(0)
    expect(await balanceOf(to)).toBe(0)

    const res = await request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: from, amount: 1000, direction: 'debit' },
          { accountId: to, amount: 1000, direction: 'credit' },
        ],
      })
    expect(res.status).toBe(201)

    // debit −1000, credit +1000 — reflected synchronously once the post returns
    expect(await balanceOf(from)).toBe(-1000)
    expect(await balanceOf(to)).toBe(1000)
    // an account not referenced by the transaction is untouched
    expect(await balanceOf(bystander)).toBe(0)
  })

  it('accumulates across successive postings to the same account', async () => {
    const a = await openAccount('acc-a', 'BRL')
    const b = await openAccount('acc-b', 'BRL')

    for (const amount of [1000, 2500]) {
      const res = await request(server)
        .post('/transactions')
        .send({
          postings: [
            { accountId: a, amount, direction: 'credit' },
            { accountId: b, amount, direction: 'debit' },
          ],
        })
      expect(res.status).toBe(201)
    }

    expect(await balanceOf(a)).toBe(3500)
    expect(await balanceOf(b)).toBe(-3500)
  })
})
