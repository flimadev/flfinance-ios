import type { Tag } from '@/src/db/schema';
import {
  createTagSchema,
  setTransactionTagsSchema,
  type CreateTagInput,
  type SetTransactionTagsInput,
} from '@/src/domain/financeSchemas';
import type { TagRepositoryContract } from '@/src/repositories/TagRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';

export class TagService {
  constructor(
    private readonly repository: TagRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async create(input: CreateTagInput): Promise<Tag> {
    const values = parseInput(createTagSchema, input);
    const existing = await this.repository.findByName(values.name);
    if (existing) return existing;
    const now = getServiceTimestamp(this.options);
    return this.repository.create({
      ...values,
      id: createServiceId(this.options),
      createdAt: now,
      updatedAt: now,
    });
  }

  async list(): Promise<Tag[]> {
    return this.repository.list();
  }

  async listForTransaction(transactionId: string): Promise<Tag[]> {
    return this.repository.listForTransaction(transactionId);
  }

  async listAssociations() {
    return this.repository.listAssociations();
  }

  async setForTransaction(input: SetTransactionTagsInput): Promise<void> {
    const values = parseInput(setTransactionTagsSchema, input);
    const tagIds = [...new Set(values.tagIds)];
    const available = new Set((await this.repository.list()).map((tag) => tag.id));
    if (tagIds.some((tagId) => !available.has(tagId))) {
      throw new Error('Uma das tags selecionadas não existe.');
    }
    await this.repository.replaceForTransaction(values.transactionId, tagIds);
  }
}
