import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { CreateAccountRepository } from '../../../application/repositories/create-account.repository'
import type { AccountAggregate } from '../../../domain/entities/account.aggregate'
import { AccountTypeOrmEntity } from '../entities/account.typeorm.entity'
import { AccountTypeOrmMapper } from '../mappers/account.typeorm.mapper'

@Injectable()
export class CreateAccountTypeOrmRepository implements CreateAccountRepository {
  constructor(
    @InjectRepository(AccountTypeOrmEntity)
    private readonly repository: Repository<AccountTypeOrmEntity>,
  ) {}

  async insert(account: AccountAggregate): Promise<AccountAggregate> {
    const entity = AccountTypeOrmMapper.toPersistence(account)
    const saved = await this.repository.save(entity)
    return AccountTypeOrmMapper.toDomain(saved)
  }
}
