import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { categories, schema, type Category } from '@/src/db/schema';

type CategoryInsert = typeof categories.$inferInsert;

export interface CategoryRepositoryContract {
  create(category: CategoryInsert): Promise<Category>;
  findById(id: string): Promise<Category | undefined>;
  list(): Promise<Category[]>;
  update(id: string, values: Partial<CategoryInsert>): Promise<Category | undefined>;
  remove(id: string, deletedAt: number): Promise<boolean>;
}

export class CategoryRepository<TResult> implements CategoryRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async create(category: CategoryInsert): Promise<Category> {
    const [created] = await this.db.insert(categories).values(category).returning();
    if (!created) {
      throw new Error('O SQLite não retornou a categoria recém-criada.');
    }

    return created;
  }

  async findById(id: string): Promise<Category | undefined> {
    const [category] = await this.db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async list(): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async update(id: string, values: Partial<CategoryInsert>): Promise<Category | undefined> {
    const [updated] = await this.db
      .update(categories)
      .set(values)
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .returning();
    return updated;
  }

  async remove(id: string, deletedAt: number): Promise<boolean> {
    const [removed] = await this.db
      .update(categories)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .returning({ id: categories.id });
    return removed !== undefined;
  }
}
