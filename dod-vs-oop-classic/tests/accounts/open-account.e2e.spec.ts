import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'

/**
 * FEAT-001 end-to-end (NestJS in-process, sqlite `:memory:`).
 *
 * Exercises the full chain Controller → UseCase → Aggregate+Validator (throw) →
 * segregated Repository → TypeORM Mapper for the three open-account endpoints,
 * plus the SRS error shape on invalid input and not-found.
 */
describe('Open account (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

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

  it('POST /accounts opens an account with zero balance (201, REQ-001)', async () => {
    const response = await request(server)
      .post('/accounts')
      .send({ ownerId: 'owner-1', currency: 'BRL' })

    expect(response.status).toBe(201)
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.body.ownerId).toBe('owner-1')
    expect(response.body.currency).toBe('BRL')
    expect(response.body.status).toBe('active')
    expect(response.body.availableBalance).toBe(0)
    expect(response.body.holdAmount).toBe(0)
    expect(response.body.version).toBe(0)
    expect(typeof response.body.createdAt).toBe('string')
  })

  it('GET /accounts/:id reads it back (200, REQ-002)', async () => {
    const created = await request(server)
      .post('/accounts')
      .send({ ownerId: 'owner-2', currency: 'USD' })
    const { id } = created.body

    const response = await request(server).get(`/accounts/${id}`)

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(id)
    expect(response.body.ownerId).toBe('owner-2')
    expect(response.body.currency).toBe('USD')
  })

  it('GET /accounts/:id returns 404 for an unknown id (REQ-002)', async () => {
    const response = await request(server).get(`/accounts/${randomUUID()}`)

    expect(response.status).toBe(404)
    expect(response.body.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('GET /accounts/:id/balance returns the available balance (200, REQ-003)', async () => {
    const created = await request(server)
      .post('/accounts')
      .send({ ownerId: 'owner-3', currency: 'EUR' })
    const { id } = created.body

    const response = await request(server).get(`/accounts/${id}/balance`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ availableBalance: 0, currency: 'EUR' })
  })

  it('POST /accounts rejects a missing ownerId (422 + SRS error shape)', async () => {
    const response = await request(server).post('/accounts').send({ currency: 'BRL' })

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('VALIDATION_ERROR')
    expect(response.body.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'ownerId' })]),
    )
  })

  it('POST /accounts rejects an unsupported currency (422)', async () => {
    const response = await request(server)
      .post('/accounts')
      .send({ ownerId: 'owner-4', currency: 'XYZ' })

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('VALIDATION_ERROR')
  })
})
