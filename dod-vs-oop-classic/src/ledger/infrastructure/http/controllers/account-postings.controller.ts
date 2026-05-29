import { Controller, Get, Inject, Param, Query } from '@nestjs/common'
import type {
  ListPostings,
  ListPostingsUseCase,
} from '../../../application/usecases/list-postings.usecase'
import { LIST_POSTINGS_USE_CASE } from '../../provider/usecases/list-postings.provider'

/**
 * HTTP surface for REQ-008 (FEAT-005). Mounted at `GET /accounts/:id/postings`
 * — the URL prefix is the account's, but the read path belongs to the
 * `ledger` context (the data lives in `postings`; only the ledger reads it).
 *
 * Query params:
 *   - `from`, `to` — ISO-8601 inclusive window (optional)
 *   - `limit` — positive integer 1..200; default 50
 *   - `cursor` — opaque base64 token returned by the previous page
 *
 * The controller does only the lightweight boundary work (parse `limit` as a
 * number; pass strings through). All semantic validation lives in the use
 * case so any caller — HTTP, CLI, batch — sees the same rules.
 */
@Controller()
export class AccountPostingsController {
  constructor(
    @Inject(LIST_POSTINGS_USE_CASE)
    private readonly listPostingsUseCase: ListPostingsUseCase,
  ) {}

  @Get('accounts/:id/postings')
  async list(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ListPostings.Output> {
    const input: ListPostings.Input = { accountId: id }
    if (from !== undefined) input.from = from
    if (to !== undefined) input.to = to
    if (limit !== undefined) input.limit = Number(limit)
    if (cursor !== undefined) input.cursor = cursor
    return this.listPostingsUseCase.execute(input)
  }
}
