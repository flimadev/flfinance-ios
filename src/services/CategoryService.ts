import type { Category } from '@/src/db/schema';
import { DomainRuleError, NotFoundError } from '@/src/domain/errors';
import { ptBR } from '@/src/i18n/pt-BR';
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@/src/domain/financeSchemas';
import type { CategoryRepositoryContract } from '@/src/repositories/CategoryRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';

export class CategoryService {
  constructor(
    private readonly repository: CategoryRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async create(input: CreateCategoryInput): Promise<Category> {
    const values = parseInput(createCategorySchema, input);
    await this.validateParent(values.parentId, values.kind);
    const now = getServiceTimestamp(this.options);

    return this.repository.create({
      ...values,
      id: createServiceId(this.options),
      createdAt: now,
      updatedAt: now,
    });
  }

  async list(): Promise<Category[]> {
    return this.repository.list();
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const values = parseInput(updateCategorySchema, input);
    const current = await this.repository.findById(id);
    if (!current || current.deletedAt !== null) {
      throw new NotFoundError();
    }

    const parentId = values.parentId === undefined ? current.parentId : values.parentId;
    const kind = values.kind ?? current.kind;
    await this.validateParent(parentId, kind, id);

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

  private async validateParent(
    parentId: string | null | undefined,
    kind: Category['kind'],
    categoryId?: string,
  ): Promise<void> {
    if (!parentId) {
      return;
    }

    const visited = new Set<string>();
    let currentId: string | null = parentId;
    while (currentId) {
      if (currentId === categoryId || visited.has(currentId)) {
        throw new DomainRuleError('Uma categoria não pode ser pai dela mesma.');
      }
      visited.add(currentId);
      const parent = await this.repository.findById(currentId);
      if (!parent || parent.deletedAt !== null || parent.archivedAt !== null) {
        throw new NotFoundError();
      }
      if (parent.kind !== kind) {
        throw new DomainRuleError(ptBR.errors.categoryParentMismatch);
      }
      currentId = parent.parentId;
    }
  }
}
