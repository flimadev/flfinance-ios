import type { Budget } from '@/src/db/schema';
import { DomainRuleError, NotFoundError } from '@/src/domain/errors';
import { createBudgetSchema, type CreateBudgetInput } from '@/src/domain/financeSchemas';
import type { BudgetRepositoryContract } from '@/src/repositories/BudgetRepository';
import type { CategoryRepositoryContract } from '@/src/repositories/CategoryRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';

export class BudgetService {
  constructor(
    private readonly repository: BudgetRepositoryContract,
    private readonly categoryRepository: CategoryRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async save(input: CreateBudgetInput): Promise<Budget> {
    const values = parseInput(createBudgetSchema, input);
    const category = await this.categoryRepository.findById(values.categoryId);
    if (!category || category.deletedAt !== null || category.archivedAt !== null) {
      throw new NotFoundError();
    }
    if (category.kind !== 'expense') {
      throw new DomainRuleError('Orçamentos só podem ser vinculados a categorias de despesas.');
    }

    const now = getServiceTimestamp(this.options);
    const current = await this.repository.findByCategoryAndMonth(values.categoryId, values.month);
    if (current) {
      const updated = await this.repository.update(current.id, {
        amountCents: values.amountCents,
        updatedAt: now,
      });
      if (!updated) {
        throw new NotFoundError();
      }
      return updated;
    }

    return this.repository.create({
      ...values,
      id: createServiceId(this.options),
      createdAt: now,
      updatedAt: now,
    });
  }

  async listByMonth(month: string): Promise<Budget[]> {
    const validatedMonth = parseInput(createBudgetSchema.shape.month, month);
    return this.repository.listByMonth(validatedMonth);
  }
}
