import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'

/**
 * FEAT-002 end-to-end (NestJS in-process, sqlite `:memory:`).
 *
 * Full chain Controller → UseCase → AccountLookup (ACL) → TransactionAggregate
 * +Validator (throw) → atomic repository. Covers the double-entry invariants
 * and the SRS error shape.
 */
describe('Post transaction (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  async function openAccount(ownerId: string, currency: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency })
    return res.body.id as string
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

  it('POST /transactions posts a balanced double-entry transaction (201, REQ-006)', async () => {
    const from = await openAccount('owner-from', 'BRL')
    const to = await openAccount('owner-to', 'BRL')

    const res = await request(server)
      .post('/transactions')
      .send({
        reference: 'INV-1',
        postings: [
          { accountId: from, amount: 1000, direction: 'debit' },
          { accountId: to, amount: 1000, direction: 'credit' },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.body.postings).toHaveLength(2)
    expect(
      res.body.postings.reduce((acc: number, p: { amountCents: number }) => acc + p.amountCents, 0),
    ).toBe(0)
    const debit = res.body.postings.find((p: { accountId: string }) => p.accountId === from)
    expect(debit.amountCents).toBe(-1000)
    expect(debit.direction).toBe('debit')
  })

  it('rejects an unbalanced transaction (422)', async () => {
    const from = await openAccount('o1', 'BRL')
    const to = await openAccount('o2', 'BRL')

    const res = await request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: from, amount: 1000, direction: 'debit' },
          { accountId: to, amount: 500, direction: 'credit' },
        ],
      })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects fewer than 2 postings (422)', async () => {
    const acct = await openAccount('o3', 'BRL')
    const res = await request(server)
      .post('/transactions')
      .send({ postings: [{ accountId: acct, amount: 1000, direction: 'credit' }] })

    expect(res.status).toBe(422)
  })

  it('rejects a missing account (404)', async () => {
    const to = await openAccount('o4', 'BRL')
    const res = await request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: randomUUID(), amount: 1000, direction: 'debit' },
          { accountId: to, amount: 1000, direction: 'credit' },
        ],
      })

    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('rejects accounts that do not share a currency (422)', async () => {
    const brl = await openAccount('o5', 'BRL')
    const usd = await openAccount('o6', 'USD')

    const res = await request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: brl, amount: 1000, direction: 'debit' },
          { accountId: usd, amount: 1000, direction: 'credit' },
        ],
      })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })
})
