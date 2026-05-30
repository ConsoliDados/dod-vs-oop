import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'

/**
 * FEAT-007 end-to-end (NestJS in-process, sqlite `:memory:`).
 *
 * Proves the account-lifecycle slice (REQ-012/013, ADR-0010) end-to-end:
 *  - `PATCH /accounts/:id/freeze` / `PATCH /accounts/:id/activate` transitions
 *  - illegal transitions → 422
 *  - `POST /accounts/:id/closure` gated on a **ledger-recomputed** zero balance:
 *    closes at zero (200); rejected on non-zero (422 `ACCOUNT_NOT_CLOSABLE`)
 *  - `POST /transactions` referencing a non-`active` account → 422
 *    (`ACCOUNT_NOT_ACTIVE`), enforced via the status-aware `AccountLookup`
 */
describe('Account lifecycle (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  async function openAccount(ownerId: string, currency: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency })
    return res.body.id as string
  }

  async function post(from: string, to: string, amount: number): Promise<request.Response> {
    return request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: from, amount, direction: 'debit' },
          { accountId: to, amount, direction: 'credit' },
        ],
      })
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

  it('freezes then activates an account (REQ-012)', async () => {
    const id = await openAccount('owner-1', 'BRL')

    const frozen = await request(server).patch(`/accounts/${id}/freeze`)
    expect(frozen.status).toBe(200)
    expect(frozen.body.status).toBe('frozen')
    expect(frozen.body.version).toBe(1)

    const reactivated = await request(server).patch(`/accounts/${id}/activate`)
    expect(reactivated.status).toBe(200)
    expect(reactivated.body.status).toBe('active')
    expect(reactivated.body.version).toBe(2)
  })

  it('rejects an illegal transition (freeze a closed account) → 422', async () => {
    const id = await openAccount('owner-2', 'BRL')
    await request(server).post(`/accounts/${id}/closure`)

    const res = await request(server).patch(`/accounts/${id}/freeze`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects activating an already-active account → 422', async () => {
    const id = await openAccount('owner-3', 'BRL')

    const res = await request(server).patch(`/accounts/${id}/activate`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('POST /transactions referencing a frozen account → 422 ACCOUNT_NOT_ACTIVE (REQ-006)', async () => {
    const from = await openAccount('owner-from', 'BRL')
    const to = await openAccount('owner-to', 'BRL')

    await request(server).patch(`/accounts/${from}/freeze`)

    const res = await post(from, to, 1000)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('ACCOUNT_NOT_ACTIVE')
  })

  it('closes an account at zero balance (REQ-013) → 200 closed', async () => {
    const id = await openAccount('owner-zero', 'BRL')

    const res = await request(server).post(`/accounts/${id}/closure`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('closed')
    expect(res.body.version).toBe(1)
  })

  it('rejects close at non-zero ledger balance → 422 ACCOUNT_NOT_CLOSABLE (REQ-013)', async () => {
    const from = await openAccount('owner-non-zero', 'BRL')
    const counter = await openAccount('owner-counter', 'BRL')

    const posted = await post(from, counter, 500)
    expect(posted.status).toBe(201)

    const res = await request(server).post(`/accounts/${from}/closure`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('ACCOUNT_NOT_CLOSABLE')

    // The aggregate stays in its prior status (not closed) — the precondition
    // failed before any transition was attempted on the aggregate.
    const after = await request(server).get(`/accounts/${from}`)
    expect(after.body.status).toBe('active')
  })

  it('POST /transactions referencing a closed account → 422 ACCOUNT_NOT_ACTIVE', async () => {
    const closed = await openAccount('owner-closed', 'BRL')
    const counter = await openAccount('owner-counter-2', 'BRL')
    await request(server).post(`/accounts/${closed}/closure`)

    const res = await post(closed, counter, 1000)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('ACCOUNT_NOT_ACTIVE')
  })

  it('close-by-recompute uses the LEDGER sum, not the cached balance (NFR-DATA-001)', async () => {
    // Sanity check the close path's source of truth: post a balanced tx, then
    // try to close the credited side. The ledger recompute returns +500 → 422.
    const debit = await openAccount('owner-debit', 'BRL')
    const credit = await openAccount('owner-credit', 'BRL')
    await post(debit, credit, 500)

    const res = await request(server).post(`/accounts/${credit}/closure`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('ACCOUNT_NOT_CLOSABLE')
  })

  // ── 404 paths for each lifecycle endpoint
  // (smoke covers READ paths; these prove the WRITE paths also 404 cleanly,
  // closing the `if (!account)` branch in each use case)

  it('PATCH /freeze on an unknown account → 404 ACCOUNT_NOT_FOUND', async () => {
    const { randomUUID } = await import('node:crypto')
    const res = await request(server).patch(`/accounts/${randomUUID()}/freeze`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('PATCH /activate on an unknown account → 404 ACCOUNT_NOT_FOUND', async () => {
    const { randomUUID } = await import('node:crypto')
    const res = await request(server).patch(`/accounts/${randomUUID()}/activate`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('POST /closure on an unknown account → 404 ACCOUNT_NOT_FOUND', async () => {
    const { randomUUID } = await import('node:crypto')
    const res = await request(server).post(`/accounts/${randomUUID()}/closure`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND')
  })
})
