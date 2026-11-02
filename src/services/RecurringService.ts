import type { RecurringRule } from '@/src/db/schema';
import { DomainRuleError, NotFoundError } from '@/src/domain/errors';
import { getMonthlyOccurrenceDates } from '@/src/domain/cardBilling';
import {
  createRecurringRuleSchema,
  type CreateRecurringRuleInput,
} from '@/src/domain/financeSchemas';
import type { AccountRepositoryContract } from '@/src/repositories/AccountRepository';
import type { CategoryRepositoryContract } from '@/src/repositories/CategoryRepository';
import type { RecurringRuleRepositoryContract } from '@/src/repositories/RecurringRuleRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';

export class RecurringService {
  constructor(
    private readonly repository: RecurringRuleRepositoryContract,
    private readonly accountRepository: AccountRepositoryContract,
    private readonly categoryRepository: CategoryRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async createRule(input: CreateRecurringRuleInput): Promise<RecurringRule> {
    const values = parseInput(createRecurringRuleSchema, input);
    const account = await this.accountRepository.findById(values.accountId);
    if (!account || account.deletedAt !== null || account.archivedAt !== null) {
      throw new NotFoundError();
    }
    if (account.type === 'credit_card') {
      throw new DomainRuleError('Recorrências em cartões de crédito não estão disponíveis.');
    }

    if (values.categoryId) {
      const category = await this.categoryRepository.findById(values.categoryId);
      if (!category || category.deletedAt !== null || category.archivedAt !== null) {
        throw new NotFoundError();
      }
      if (category.kind !== values.kind) {
        throw new DomainRuleError('A categoria precisa ser do mesmo tipo da recorrência.');
      }
    }

    const now = getServiceTimestamp(this.options);
    const { frequency: _frequency, ...ruleValues } = values;
    return this.repository.create({
      ...ruleValues,
      dayOfMonth: Number(values.startDate.slice(-2)),
      endDate: values.endDate ?? null,
      categoryId: values.categoryId ?? null,
      paymentMethod: values.paymentMethod ?? null,
      isActive: true,
      lastGeneratedDate: null,
      id: createServiceId(this.options),
      createdAt: now,
      updatedAt: now,
    });
  }

  async generateDue(throughDate: string): Promise<number> {
    const date = parseInput(createRecurringRuleSchema.shape.startDate, throughDate);
    const rules = await this.repository.listActive();
    let generated = 0;

    for (const rule of rules) {
      const occurrences = getMonthlyOccurrenceDates(
        rule.startDate,
        rule.dayOfMonth,
        date,
        rule.lastGeneratedDate,
        rule.endDate,
      );
      const transactionRows = occurrences.map((occurrenceDate) => ({
        date: occurrenceDate,
        transaction: {
          id: createServiceId(this.options),
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          kind: rule.kind,
          amountCents: rule.amountCents,
          date: occurrenceDate,
          description: rule.description,
          notes: null,
          paymentMethod: rule.paymentMethod,
          transferAccountId: null,
          installmentGroupId: null,
          installmentNumber: null,
          installmentTotal: null,
          invoiceId: null,
          recurringId: rule.id,
          isPaid: false,
          deletedAt: null,
          createdAt: getServiceTimestamp(this.options),
          updatedAt: getServiceTimestamp(this.options),
        },
      }));
      const deactivate = Boolean(rule.endDate && rule.endDate <= date);
      generated += await this.repository.generate(
        rule.id,
        transactionRows,
        getServiceTimestamp(this.options),
        deactivate,
      );
    }

    return generated;
  }
}
