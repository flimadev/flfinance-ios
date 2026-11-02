import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { BudgetEditorSheet } from '@/src/features/budgets/BudgetEditorSheet';
import { BudgetProgressRow } from '@/src/features/budgets/BudgetProgressRow';
import { useBudgets } from '@/src/features/budgets/useBudgets';
import { summarizeBudgets, type BudgetSummaryRow } from '@/src/domain/budgets';
import { getMonthPeriod } from '@/src/domain/dashboard';
import { ptBR } from '@/src/i18n/pt-BR';
import { useAppPreferences } from '@/src/preferences/AppPreferencesProvider';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { Button, EmptyState, Screen, Text } from '@/src/ui';

function getMonthFromOffset(offset: number, monthStartDay: number): string {
  return getMonthPeriod(new Date(), offset, monthStartDay).fromDate.slice(0, 7);
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthNumber - 1, 1),
  );
}

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const { preferences } = useAppPreferences();
  const [monthOffset, setMonthOffset] = useState(0);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const month = getMonthFromOffset(monthOffset, preferences.monthStartDay);
  const { budgets, categories, transactions, loading, error, reload, saveBudget } = useBudgets(
    month,
    preferences.monthStartDay,
  );

  const rows = useMemo(
    () => summarizeBudgets(categories, budgets, transactions),
    [budgets, categories, transactions],
  );
  const editingRow = rows.find((row) => row.category.id === editingCategoryId);
  const monthLabel = formatMonth(month);

  async function saveLimit(amountCents: number) {
    if (!editingRow) {
      return;
    }

    try {
      await saveBudget({
        categoryId: editingRow.category.id,
        month,
        amountCents,
      });
      setMutationError(null);
      setEditingCategoryId(null);
    } catch (saveError) {
      console.error('Não foi possível salvar o orçamento.', saveError);
      setMutationError(saveError instanceof Error ? saveError.message : ptBR.errors.unexpected);
    }
  }

  return (
    <Screen contentContainerStyle={styles.content} scrollable testID="budgets-screen">
      <View style={styles.header}>
        <Text variant="title">{ptBR.budgets.title}</Text>
      </View>
      <Text tone="secondary">{ptBR.budgets.description}</Text>

      <View style={[styles.monthSelector, { backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityLabel={ptBR.budgets.previousMonth}
          accessibilityRole="button"
          onPress={() => setMonthOffset((offset) => offset - 1)}
          style={styles.monthButton}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            size={20}
            tintColor={colors.text}
          />
        </Pressable>
        <Text accessibilityLiveRegion="polite" variant="label">
          {ptBR.budgets.monthLabel(monthLabel)}
        </Text>
        <Pressable
          accessibilityLabel={ptBR.budgets.nextMonth}
          accessibilityRole="button"
          onPress={() => setMonthOffset((offset) => offset + 1)}
          style={styles.monthButton}
        >
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={20}
            tintColor={colors.text}
          />
        </Pressable>
      </View>

      {mutationError ? (
        <Text accessibilityRole="alert" tone="negative">
          {mutationError}
        </Text>
      ) : null}
      {error ? (
        <View style={styles.error}>
          <Text accessibilityRole="alert" tone="negative">
            {error}
          </Text>
          <Button haptic={false} onPress={() => void reload()}>
            {ptBR.budgets.retry}
          </Button>
        </View>
      ) : null}
      {loading && categories.length === 0 ? (
        <ActivityIndicator
          accessibilityLabel={ptBR.budgets.loading}
          color={colors.primary}
          size="large"
          style={styles.loader}
        />
      ) : rows.length ? (
        <View style={styles.budgetList}>
          {rows.map((row: BudgetSummaryRow) => (
            <BudgetProgressRow
              key={row.category.id}
              onEdit={() => {
                setMutationError(null);
                setEditingCategoryId(row.category.id);
              }}
              row={row}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          description={ptBR.budgets.noCategoriesDescription}
          title={ptBR.budgets.noCategoriesTitle}
        />
      )}

      {editingRow ? (
        <BudgetEditorSheet
          budget={editingRow.budget}
          category={editingRow.category}
          error={mutationError}
          key={`${editingRow.category.id}-${month}-${editingRow.budget?.amountCents ?? 'new'}`}
          monthLabel={monthLabel}
          onClose={() => {
            setMutationError(null);
            setEditingCategoryId(null);
          }}
          onSave={saveLimit}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[3],
    paddingBottom: spacing[8],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthSelector: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[2],
  },
  monthButton: {
    alignItems: 'center',
    height: layout.touchTarget,
    justifyContent: 'center',
    width: layout.touchTarget,
  },
  budgetList: {
    gap: spacing[3],
  },
  loader: {
    marginTop: spacing[8],
  },
  error: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
});
