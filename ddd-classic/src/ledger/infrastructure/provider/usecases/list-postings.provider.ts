import type { Provider } from '@nestjs/common'
import type { AccountLookup } from '../../../application/ports/account-lookup.port'
import type { ListPostingsRepository } from '../../../application/repositories/list-postings.repository'
import { ListPostingsUseCase } from '../../../application/usecases/list-postings.usecase'
import { ACCOUNT_LOOKUP } from '../acl/account-lookup.provider'
import { LIST_POSTINGS_REPOSITORY } from '../repositories/list-postings.provider'

/** NestJS DI token for {@link ListPostingsUseCase}. */
export const LIST_POSTINGS_USE_CASE = Symbol('ListPostingsUseCase')

export const listPostingsUseCaseProvider: Provider = {
  provide: LIST_POSTINGS_USE_CASE,
  inject: [ACCOUNT_LOOKUP, LIST_POSTINGS_REPOSITORY],
  useFactory: (accountLookup: AccountLookup, listPostings: ListPostingsRepository) =>
    new ListPostingsUseCase(accountLookup, listPostings),
}
