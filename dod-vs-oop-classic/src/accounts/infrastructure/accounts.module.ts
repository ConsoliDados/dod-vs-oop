import { Inject, Module, type OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PostingTypeOrmEntity } from '../../ledger/infrastructure/typeorm/entities/posting.typeorm.entity'
import type { EventBus } from '../../shared/application/event-bus'
import { EVENT_BUS } from '../../shared/infrastructure/event-bus/event-bus.provider'
import {
  type OnTransactionPostedHandler,
  TRANSACTION_POSTED_EVENT_TYPE,
} from '../application/handlers/on-transaction-posted.handler'
import { AccountController } from './http/controllers/account.controller'
import { ledgerBalanceReaderProvider } from './provider/acl/ledger-balance-reader.provider'
import {
  ON_TRANSACTION_POSTED_HANDLER,
  onTransactionPostedHandlerProvider,
} from './provider/handlers/on-transaction-posted.handler.provider'
import { createAccountRepositoryProvider } from './provider/repositories/create-account.provider'
import { getAccountRepositoryProvider } from './provider/repositories/get-account.provider'
import { updateAccountRepositoryProvider } from './provider/repositories/update-account.provider'
import { activateAccountUseCaseProvider } from './provider/usecases/activate-account.provider'
import { closeAccountUseCaseProvider } from './provider/usecases/close-account.provider'
import { freezeAccountUseCaseProvider } from './provider/usecases/freeze-account.provider'
import { getAccountUseCaseProvider } from './provider/usecases/get-account.provider'
import { getBalanceUseCaseProvider } from './provider/usecases/get-balance.provider'
import { openAccountUseCaseProvider } from './provider/usecases/open-account.provider'
import { AccountTypeOrmEntity } from './typeorm/entities/account.typeorm.entity'

/**
 * Accounts bounded context (REQ-001/002/003, REQ-012/013).
 *
 * The NestJS module lives inside `infrastructure/` so the framework is fully
 * encapsulated in the infra layer of the vertical slice: domain + application
 * are framework-free, and swapping NestJS for another runtime (e.g. Elysia/Bun)
 * touches only `infrastructure/`. Ports are bound to implementations via the
 * providers in `infrastructure/provider/`.
 *
 * FEAT-003: subscribes to `ledger`'s `TransactionPosted` on the in-memory bus to
 * fold posted transactions into the cached `availableBalance` (ADR-0006/0008).
 *
 * FEAT-007: imports `PostingTypeOrmEntity` (read-only) so the
 * `LedgerBalanceReaderTypeOrm` ACL can SUM the postings table when
 * `CloseAccountUseCase` recomputes the balance for closure (ADR-0010, ADR-0009
 * distribution seam — single accounts→ledger infra touch).
 */
@Module({
  imports: [TypeOrmModule.forFeature([AccountTypeOrmEntity, PostingTypeOrmEntity])],
  controllers: [AccountController],
  providers: [
    createAccountRepositoryProvider,
    getAccountRepositoryProvider,
    updateAccountRepositoryProvider,
    openAccountUseCaseProvider,
    getAccountUseCaseProvider,
    getBalanceUseCaseProvider,
    freezeAccountUseCaseProvider,
    activateAccountUseCaseProvider,
    closeAccountUseCaseProvider,
    ledgerBalanceReaderProvider,
    onTransactionPostedHandlerProvider,
  ],
})
export class AccountsModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    @Inject(ON_TRANSACTION_POSTED_HANDLER)
    private readonly onTransactionPosted: OnTransactionPostedHandler,
  ) {}

  /** Subscribe the cross-context balance handler once the DI graph is ready (FEAT-003). */
  onModuleInit(): void {
    this.eventBus.register(TRANSACTION_POSTED_EVENT_TYPE, this.onTransactionPosted)
  }
}
