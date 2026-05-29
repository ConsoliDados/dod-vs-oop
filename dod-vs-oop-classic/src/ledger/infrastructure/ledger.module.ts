import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AccountTypeOrmEntity } from '../../accounts/infrastructure/typeorm/entities/account.typeorm.entity'
import { AccountPostingsController } from './http/controllers/account-postings.controller'
import { TransactionController } from './http/controllers/transaction.controller'
import { accountLookupProvider } from './provider/acl/account-lookup.provider'
import { createTransactionRepositoryProvider } from './provider/repositories/create-transaction.provider'
import { getTransactionRepositoryProvider } from './provider/repositories/get-transaction.provider'
import { listPostingsRepositoryProvider } from './provider/repositories/list-postings.provider'
import { listPostingsUseCaseProvider } from './provider/usecases/list-postings.provider'
import { postTransactionUseCaseProvider } from './provider/usecases/post-transaction.provider'
import { reverseTransactionUseCaseProvider } from './provider/usecases/reverse-transaction.provider'
import { PostingTypeOrmEntity } from './typeorm/entities/posting.typeorm.entity'
import { TransactionTypeOrmEntity } from './typeorm/entities/transaction.typeorm.entity'

/**
 * Ledger bounded context (REQ-006, REQ-007, REQ-008). NestJS lives in
 * `infrastructure/` (ADR-0005). Registers the accounts persistence entity
 * read-only for the `AccountLookup` ACL — it never imports `accounts/domain`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionTypeOrmEntity,
      PostingTypeOrmEntity,
      AccountTypeOrmEntity,
    ]),
  ],
  controllers: [TransactionController, AccountPostingsController],
  providers: [
    createTransactionRepositoryProvider,
    getTransactionRepositoryProvider,
    listPostingsRepositoryProvider,
    accountLookupProvider,
    postTransactionUseCaseProvider,
    reverseTransactionUseCaseProvider,
    listPostingsUseCaseProvider,
  ],
})
export class LedgerModule {}
