import { type INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module'

/**
 * Smoke e2e — boots the NestJS app in-process and hits the default GET /.
 *
 * Validates that:
 * - AppModule wires correctly (NestJS bootstrap works with vitest)
 * - The HTTP layer responds (Express adapter is alive)
 * - No regression from removing jest/eslint/prettier or adding biome/vitest
 */
describe('AppController (e2e smoke)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET / returns 200 with "Hello World!"', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0]
    const response = await request(server).get('/')
    expect(response.status).toBe(200)
    expect(response.text).toBe('Hello World!')
  })
})
