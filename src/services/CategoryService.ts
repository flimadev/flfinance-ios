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

  async archive(id: string): Promise<void> {
    const categories = await this.repository.list();
    const current = categories.find((category) => category.id === id);
    if (!current) throw new NotFoundError();

    const timestamp = getServiceTimestamp(this.options);
    const toArchive = [current];
    const archivedIds = new Set<string>();
    for (let index = 0; index < toArchive.length; index += 1) {
      const parent = toArchive[index];
      if (!parent) continue;
      if (archivedIds.has(parent.id)) continue;
      archivedIds.add(parent.id);
      toArchive.push(
        ...categories.filter(
          (category) => category.parentId === parent.id && !archivedIds.has(category.id),
        ),
      );
    }

    for (const category of toArchive) {
      await this.repository.update(category.id, { archivedAt: timestamp, updatedAt: timestamp });
    }
  }

  async restore(id: string): Promise<void> {
    const categories = await this.repository.list();
    const current = categories.find((category) => category.id === id);
    if (!current) throw new NotFoundError();
    const toRestore = [current];
    const restoredIds = new Set<string>();
    for (let index = 0; index < toRestore.length; index += 1) {
      const parent = toRestore[index];
      if (!parent) continue;
      if (restoredIds.has(parent.id)) continue;
      restoredIds.add(parent.id);
      toRestore.push(
        ...categories.filter(
          (category) => category.parentId === parent.id && !restoredIds.has(category.id),
        ),
      );
    }
    const timestamp = getServiceTimestamp(this.options);
    for (const category of toRestore) {
      await this.repository.update(category.id, { archivedAt: null, updatedAt: timestamp });
    }
  }

  async reorder(id: string, sortOrder: number): Promise<Category> {
    const value = parseInput(createCategorySchema.pick({ sortOrder: true }), { sortOrder });
    const updated = await this.repository.update(id, {
      sortOrder: value.sortOrder,
      updatedAt: getServiceTimestamp(this.options),
    });
    if (!updated) throw new NotFoundError();
    return updated;
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
