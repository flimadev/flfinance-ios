import type { Account } from '@/src/db/schema';
import { NotFoundError } from '@/src/domain/errors';
import {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '@/src/domain/financeSchemas';
import type { AccountRepositoryContract } from '@/src/repositories/AccountRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';

export class AccountService {
  constructor(
    private readonly repository: AccountRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async create(input: CreateAccountInput): Promise<Account> {
    const values = parseInput(createAccountSchema, input);
    const now = getServiceTimestamp(this.options);

    return this.repository.create({
      ...values,
      id: createServiceId(this.options),
      createdAt: now,
      updatedAt: now,
    });
  }

  async list(): Promise<Account[]> {
    return this.repository.list();
  }

  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    const values = parseInput(updateAccountSchema, input);
    const current = await this.repository.findById(id);
    if (!current || current.deletedAt !== null) {
      throw new NotFoundError();
    }

    const updated = await this.repository.update(id, {
      ...values,
      updatedAt: getServiceTimestamp(this.options),
    });
    if (!updated) {
      throw new NotFoundError();
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.repository.remove(id, getServiceTimestamp(this.options));
    if (!removed) {
      throw new NotFoundError();
    }
  }
}
