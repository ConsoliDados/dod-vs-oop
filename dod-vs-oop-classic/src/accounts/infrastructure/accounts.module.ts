import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AccountController } from './http/controllers/account.controller'
import { createAccountRepositoryProvider } from './provider/repositories/create-account.provider'
import { getAccountRepositoryProvider } from './provider/repositories/get-account.provider'
import { getAccountUseCaseProvider } from './provider/usecases/get-account.provider'
import { getBalanceUseCaseProvider } from './provider/usecases/get-balance.provider'
import { openAccountUseCaseProvider } from './provider/usecases/open-account.provider'
import { AccountTypeOrmEntity } from './typeorm/entities/account.typeorm.entity'

/**
 * Accounts bounded context (REQ-001/002/003).
 *
 * The NestJS module lives inside `infrastructure/` so the framework is fully
 * encapsulated in the infra layer of the vertical slice: domain + application
 * are framework-free, and swapping NestJS for another runtime (e.g. Elysia/Bun)
 * touches only `infrastructure/`. Ports are bound to implementations via the
 * providers in `infrastructure/provider/`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AccountTypeOrmEntity])],
  controllers: [AccountController],
  providers: [
    createAccountRepositoryProvider,
    getAccountRepositoryProvider,
    openAccountUseCaseProvider,
    getAccountUseCaseProvider,
    getBalanceUseCaseProvider,
  ],
})
export class AccountsModule {}
