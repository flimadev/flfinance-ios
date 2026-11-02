import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Category, Tag } from '@/src/db/schema';
import type {
  CreateCategoryInput,
  CreateTagInput,
  UpdateCategoryInput,
} from '@/src/domain/financeSchemas';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from '@/src/features/transactions/transactionData';

export function useCategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { categoryService, tagService } = await getTransactionServices();
      const [nextCategories, nextTags] = await Promise.all([
        categoryService.list(),
        tagService.list(),
      ]);
      setCategories(nextCategories);
      setTags(nextTags);
      setLoadError(null);
    } catch (error) {
      console.error('Não foi possível carregar categorias e tags.', error);
      setLoadError(ptBR.categories.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const createCategory = useCallback(
    async (input: CreateCategoryInput) => {
      const { categoryService } = await getTransactionServices();
      await categoryService.create(input);
      await reload();
    },
    [reload],
  );

  const updateCategory = useCallback(
    async (id: string, input: UpdateCategoryInput) => {
      const { categoryService } = await getTransactionServices();
      await categoryService.update(id, input);
      await reload();
    },
    [reload],
  );

  const archiveCategory = useCallback(
    async (id: string) => {
      const { categoryService } = await getTransactionServices();
      await categoryService.archive(id);
      await reload();
    },
    [reload],
  );

  const restoreCategory = useCallback(
    async (id: string) => {
      const { categoryService } = await getTransactionServices();
      await categoryService.restore(id);
      await reload();
    },
    [reload],
  );

  const reorderCategories = useCallback(
    async (changes: { id: string; sortOrder: number }[]) => {
      const { categoryService } = await getTransactionServices();
      for (const change of changes) {
        await categoryService.reorder(change.id, change.sortOrder);
      }
      await reload();
    },
    [reload],
  );

  const createTag = useCallback(
    async (input: CreateTagInput) => {
      const { tagService } = await getTransactionServices();
      const created = await tagService.create(input);
      await reload();
      return created;
    },
    [reload],
  );

  return {
    categories,
    tags,
    loading,
    loadError,
    reload,
    createCategory,
    updateCategory,
    archiveCategory,
    restoreCategory,
    reorderCategories,
    createTag,
  };
}
