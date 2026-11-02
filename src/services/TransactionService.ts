import type { Transaction } from '@/src/db/schema';
import { DomainRuleError, NotFoundError } from '@/src/domain/errors';
import { ptBR } from '@/src/i18n/pt-BR';
import {
  createTransactionSchema,
  transactionFiltersSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type TransactionFilters,
  type UpdateTransactionInput,
} from '@/src/domain/financeSchemas';
import type { AccountRepositoryContract } from '@/src/repositories/AccountRepository';
import type { CategoryRepositoryContract } from '@/src/repositories/CategoryRepository';
import type { TransactionRepositoryContract } from '@/src/repositories/TransactionRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';

export class TransactionService {
  constructor(
    private readonly repository: TransactionRepositoryContract,
    private readonly accountRepository: AccountRepositoryContract,
    private readonly categoryRepository: CategoryRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const values = parseInput(createTransactionSchema, input);
    await this.validateReferences(values);
    const now = getServiceTimestamp(this.options);

    return this.repository.create({
      ...values,
      id: createServiceId(this.options),
      createdAt: now,
      updatedAt: now,
    });
  }

  async list(filters: TransactionFilters = {}): Promise<Transaction[]> {
    const validatedFilters = parseInput(transactionFiltersSchema, filters);
    return this.repository.list(validatedFilters);
  }

  async update(id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const changes = parseInput(updateTransactionSchema, input);
    const current = await this.repository.findById(id);
    if (!current || current.deletedAt !== null) {
      throw new NotFoundError();
    }

    const merged = parseInput(createTransactionSchema, {
      ...current,
      ...changes,
      categoryId: changes.categoryId === undefined ? current.categoryId : changes.categoryId,
      notes: changes.notes === undefined ? current.notes : changes.notes,
      paymentMethod:
        changes.paymentMethod === undefined ? current.paymentMethod : changes.paymentMethod,
      transferAccountId:
        changes.transferAccountId === undefined
          ? current.transferAccountId
          : changes.transferAccountId,
      installmentGroupId:
        changes.installmentGroupId === undefined
          ? current.installmentGroupId
          : changes.installmentGroupId,
      invoiceId: changes.invoiceId === undefined ? current.invoiceId : changes.invoiceId,
      recurringId: changes.recurringId === undefined ? current.recurringId : changes.recurringId,
    });
    await this.validateReferences(merged);

    const updated = await this.repository.update(id, {
      ...merged,
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

  async restore(id: string): Promise<void> {
    const restored = await this.repository.restore(id, getServiceTimestamp(this.options));
    if (!restored) {
      throw new NotFoundError();
    }
  }

  private async validateReferences(
    transaction: Pick<Transaction, 'accountId' | 'kind'> &
      Partial<Pick<Transaction, 'categoryId' | 'transferAccountId'>>,
  ): Promise<void> {
    const account = await this.accountRepository.findById(transaction.accountId);
    if (!account || account.deletedAt !== null || account.archivedAt !== null) {
      throw new DomainRuleError(ptBR.errors.accountUnavailable);
    }

    if (transaction.kind === 'transfer') {
      if (!transaction.transferAccountId || transaction.transferAccountId === account.id) {
        throw new DomainRuleError(ptBR.errors.invalidTransfer);
      }
      const transferAccount = await this.accountRepository.findById(transaction.transferAccountId);
      if (
        !transferAccount ||
        transferAccount.deletedAt !== null ||
        transferAccount.archivedAt !== null
      ) {
        throw new DomainRuleError(ptBR.errors.accountUnavailable);
      }
    }

    if (transaction.categoryId) {
      const category = await this.categoryRepository.findById(transaction.categoryId);
      if (!category || category.deletedAt !== null || category.archivedAt !== null) {
        throw new DomainRuleError(ptBR.errors.categoryUnavailable);
      }
      if (category.kind !== transaction.kind) {
        throw new DomainRuleError(ptBR.errors.categoryKindMismatch);
      }
    }
  }
}
