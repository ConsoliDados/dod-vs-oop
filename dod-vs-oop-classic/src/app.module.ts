import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AccountsModule } from './accounts/infrastructure/accounts.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter'
import { SharedModule } from './shared/shared.module'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      autoLoadEntities: true,
    }),
    SharedModule,
    AccountsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
