import type { Transaction } from '@/src/db/schema';
import { createInstallmentSchedule, getAccountCardSettings } from '@/src/domain/cardBilling';
import { DomainRuleError, NotFoundError } from '@/src/domain/errors';
import { createTransactionSchema } from '@/src/domain/financeSchemas';
import type { AccountRepositoryContract } from '@/src/repositories/AccountRepository';
import type { CategoryRepositoryContract } from '@/src/repositories/CategoryRepository';
import type {
  InstallmentInsert,
  InvoiceRepositoryContract,
} from '@/src/repositories/InvoiceRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';

export type InstallmentPurchaseInput = {
  accountId: string;
  categoryId: string | null;
  amountCents: number;
  date: string;
  description: string;
  installmentCount: number;
};

export class CardService {
  constructor(
    private readonly invoiceRepository: InvoiceRepositoryContract,
    private readonly accountRepository: AccountRepositoryContract,
    private readonly categoryRepository: CategoryRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async createInstallmentPurchase(input: InstallmentPurchaseInput): Promise<Transaction[]> {
    const account = await this.accountRepository.findById(input.accountId);
    if (!account || account.deletedAt !== null || account.archivedAt !== null) {
      throw new NotFoundError();
    }

    const cardSettings = getAccountCardSettings(account);
    const transactionInput = parseInput(createTransactionSchema, {
      accountId: input.accountId,
      categoryId: input.categoryId,
      kind: 'expense',
      amountCents: input.amountCents,
      date: input.date,
      description: input.description,
      paymentMethod: 'credit',
      isPaid: false,
    });

    if (transactionInput.categoryId) {
      const category = await this.categoryRepository.findById(transactionInput.categoryId);
      if (!category || category.deletedAt !== null || category.archivedAt !== null) {
        throw new NotFoundError();
      }
      if (category.kind !== 'expense') {
        throw new DomainRuleError('Uma compra no cartão exige categoria de despesa.');
      }
    }

    const schedule = createInstallmentSchedule(
      transactionInput.date,
      transactionInput.amountCents,
      input.installmentCount,
      cardSettings,
    );
    const groupId = createServiceId(this.options);
    const now = getServiceTimestamp(this.options);
    const items: InstallmentInsert[] = schedule.map((installment) => ({
      invoice: {
        id: createServiceId(this.options),
        accountId: account.id,
        billingMonth: installment.billingMonth,
        dueDate: installment.dueDate,
        status: 'open',
        paidAt: null,
        paymentAccountId: null,
        paymentTransactionId: null,
        createdAt: now,
        updatedAt: now,
      },
      transaction: {
        id: createServiceId(this.options),
        accountId: account.id,
        categoryId: transactionInput.categoryId,
        kind: 'expense',
        amountCents: installment.amountCents,
        date: installment.transactionDate,
        description:
          input.installmentCount === 1
            ? transactionInput.description
            : `${transactionInput.description} (${installment.installmentNumber}/${input.installmentCount})`,
        notes: null,
        paymentMethod: 'credit',
        transferAccountId: null,
        installmentGroupId: input.installmentCount > 1 ? groupId : null,
        installmentNumber: input.installmentCount > 1 ? installment.installmentNumber : null,
        installmentTotal: input.installmentCount > 1 ? input.installmentCount : null,
        invoiceId: null,
        recurringId: null,
        isPaid: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    }));

    return this.invoiceRepository.createInstallments(items);
  }
}
