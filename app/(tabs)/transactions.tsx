import { FlashList } from '@shopify/flash-list';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AmountText, Button, Card, EmptyState, Screen, Text } from '@/src/ui';
import { ptBR } from '@/src/i18n/pt-BR';
import {
  getLocalDateString,
  groupTransactionsByDate,
  normalizeSearchText,
  type TransactionRow,
} from '@/src/domain/transactions';
import type { Account, Category, Transaction } from '@/src/db/schema';
import type { CreateTransactionInput } from '@/src/domain/financeSchemas';
import { radius, spacing, useTheme } from '@/src/theme';
import { TransactionFormSheet } from '@/src/features/transactions/TransactionFormSheet';
import { useTransactions } from '@/src/features/transactions/useTransactions';

type KindFilter = 'all' | Transaction['kind'];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const {
    accounts,
    categories,
    transactions,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    restore,
  } = useTransactions();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pendingUndo, setPendingUndo] = useState<Transaction | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.deletedAt === null && account.archivedAt === null),
    [accounts],
  );
  const activeCategories = useMemo(
    () => categories.filter((category) => category.deletedAt === null),
    [categories],
  );
  const accountById = useMemo(
    () => new Map<string, Account>(activeAccounts.map((account) => [account.id, account])),
    [activeAccounts],
  );
  const categoryById = useMemo(
    () => new Map<string, Category>(activeCategories.map((category) => [category.id, category])),
    [activeCategories],
  );
  const now = new Date();
  const today = getLocalDateString(now);
  const displayedMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const selectedMonth = getLocalDateString(displayedMonth).slice(0, 7);
  const monthLabel =
    monthOffset === 0
      ? ptBR.transactions.thisMonth
      : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(displayedMonth);
  const normalizedQuery = normalizeSearchText(query);

  const visibleTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (period === 'month' && transaction.date.slice(0, 7) !== selectedMonth) {
          return false;
        }
        if (kindFilter !== 'all' && transaction.kind !== kindFilter) {
          return false;
        }
        if (accountFilter) {
          const belongsToAccount =
            transaction.accountId === accountFilter ||
            transaction.transferAccountId === accountFilter;
          if (!belongsToAccount) {
            return false;
          }
        }
        if (categoryFilter && transaction.categoryId !== categoryFilter) {
          return false;
        }
        if (normalizedQuery) {
          const accountName = accountById.get(transaction.accountId)?.name ?? '';
          const categoryName = transaction.categoryId
            ? (categoryById.get(transaction.categoryId)?.name ?? '')
            : '';
          const searchable = normalizeSearchText(
            [transaction.description, transaction.notes ?? '', accountName, categoryName].join(' '),
          );
          if (!searchable.includes(normalizedQuery)) {
            return false;
          }
        }
        return true;
      }),
    [
      accountById,
      accountFilter,
      categoryById,
      categoryFilter,
      kindFilter,
      normalizedQuery,
      period,
      selectedMonth,
      transactions,
    ],
  );
  const rows = useMemo(() => groupTransactionsByDate(visibleTransactions), [visibleTransactions]);

  useEffect(() => {
    if (!pendingUndo) {
      return;
    }

    undoTimeout.current = setTimeout(() => setPendingUndo(null), 5_000);
    return () => {
      if (undoTimeout.current) {
        clearTimeout(undoTimeout.current);
      }
    };
  }, [pendingUndo]);

  const openNewForm = useCallback(() => {
    setEditing(null);
    setMutationError(null);
    setFormVisible(true);
  }, []);

  const openEditForm = useCallback((transaction: Transaction) => {
    setEditing(transaction);
    setMutationError(null);
    setFormVisible(true);
  }, []);

  async function saveTransaction(input: CreateTransactionInput) {
    if (editing) {
      await update(editing.id, input);
    } else {
      await create(input);
    }
  }

  const deleteTransaction = useCallback(
    async (transaction: Transaction) => {
      setMutationError(null);
      try {
        await remove(transaction.id);
        setPendingUndo(transaction);
      } catch (deleteError) {
        console.error('Não foi possível excluir o lançamento.', deleteError);
        setMutationError(
          deleteError instanceof Error ? deleteError.message : ptBR.errors.unexpected,
        );
      }
    },
    [remove],
  );

  async function undoDelete() {
    if (!pendingUndo) {
      return;
    }
    const transaction = pendingUndo;
    setPendingUndo(null);
    setMutationError(null);
    try {
      await restore(transaction.id);
    } catch (restoreError) {
      console.error('Não foi possível desfazer a exclusão do lançamento.', restoreError);
      setMutationError(
        restoreError instanceof Error ? restoreError.message : ptBR.errors.unexpected,
      );
    }
  }

  const renderRow = useCallback(
    ({ item }: { item: TransactionRow }) => {
      if (item.type === 'date') {
        return <DateHeader date={item.date} today={today} />;
      }

      const transaction = item.transaction;
      return (
        <ReanimatedSwipeable
          containerStyle={styles.swipeContainer}
          friction={2}
          overshootRight={false}
          renderRightActions={() => (
            <Pressable
              accessibilityLabel={`${ptBR.transactions.deleteAccessibility}: ${transaction.description}`}
              accessibilityRole="button"
              onPress={() => void deleteTransaction(transaction)}
              style={[styles.deleteAction, { backgroundColor: colors.negative }]}
            >
              <Text tone="default" variant="label" style={{ color: colors.onPrimary }}>
                {ptBR.transactions.delete}
              </Text>
            </Pressable>
          )}
        >
          <TransactionCard
            account={accountById.get(transaction.accountId)}
            category={transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined}
            onPress={() => openEditForm(transaction)}
            transaction={transaction}
            transferAccount={
              transaction.transferAccountId
                ? accountById.get(transaction.transferAccountId)
                : undefined
            }
          />
        </ReanimatedSwipeable>
      );
    },
    [accountById, categoryById, colors, deleteTransaction, openEditForm, today],
  );

  return (
    <Screen testID="transactions-screen" style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text variant="title">{ptBR.transactions.title}</Text>
        </View>
        <Button
          accessibilityLabel={ptBR.transactions.add}
          disabled={loading || activeAccounts.length === 0}
          onPress={openNewForm}
          style={styles.addButton}
        >
          +
        </Button>
      </View>

      <TextInput
        accessibilityLabel={ptBR.transactions.searchPlaceholder}
        onChangeText={setQuery}
        placeholder={ptBR.transactions.searchPlaceholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        selectionColor={colors.primary}
        style={[
          styles.search,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={query}
      />

      <ScrollView
        horizontal
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
      >
        <FilterChip
          accessibilityLabel={ptBR.transactions.previousMonth}
          label="‹"
          onPress={() => {
            setMonthOffset((offset) => offset - 1);
            setPeriod('month');
          }}
          selected={false}
        />
        <FilterChip
          label={monthLabel}
          onPress={() => setPeriod('month')}
          selected={period === 'month'}
        />
        <FilterChip
          accessibilityLabel={ptBR.transactions.nextMonth}
          disabled={monthOffset >= 0}
          label="›"
          onPress={() => {
            setMonthOffset((offset) => Math.min(offset + 1, 0));
            setPeriod('month');
          }}
          selected={false}
        />
        <FilterChip
          label={ptBR.transactions.allTime}
          onPress={() => setPeriod('all')}
          selected={period === 'all'}
        />
      </ScrollView>

      <ScrollView
        horizontal
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
      >
        <FilterChip
          label={ptBR.transactions.typeAll}
          onPress={() => setKindFilter('all')}
          selected={kindFilter === 'all'}
        />
        <FilterChip
          label={ptBR.transactions.typeExpense}
          onPress={() => setKindFilter('expense')}
          selected={kindFilter === 'expense'}
        />
        <FilterChip
          label={ptBR.transactions.typeIncome}
          onPress={() => setKindFilter('income')}
          selected={kindFilter === 'income'}
        />
        <FilterChip
          label={ptBR.transactions.typeTransfer}
          onPress={() => setKindFilter('transfer')}
          selected={kindFilter === 'transfer'}
        />
      </ScrollView>

      {activeAccounts.length > 1 ? (
        <ScrollView
          horizontal
          contentContainerStyle={styles.filterRow}
          showsHorizontalScrollIndicator={false}
        >
          <FilterChip
            label={ptBR.transactions.allAccounts}
            onPress={() => setAccountFilter('')}
            selected={!accountFilter}
          />
          {activeAccounts.map((account) => (
            <FilterChip
              key={account.id}
              label={account.name}
              onPress={() => setAccountFilter(account.id)}
              selected={accountFilter === account.id}
            />
          ))}
        </ScrollView>
      ) : null}

      {activeCategories.length > 0 ? (
        <ScrollView
          horizontal
          contentContainerStyle={styles.filterRow}
          showsHorizontalScrollIndicator={false}
        >
          <FilterChip
            label={ptBR.transactions.allCategories}
            onPress={() => setCategoryFilter('')}
            selected={!categoryFilter}
          />
          {activeCategories
            .filter((category) => category.archivedAt === null)
            .map((category) => (
              <FilterChip
                key={category.id}
                label={category.name}
                onPress={() => setCategoryFilter(category.id)}
                selected={categoryFilter === category.id}
              />
            ))}
        </ScrollView>
      ) : null}

      {error || mutationError ? (
        <View
          accessibilityRole="alert"
          style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle }]}
        >
          <Text tone="negative">{mutationError ?? error}</Text>
          {error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void reload()}
              style={styles.retry}
            >
              <Text tone="negative" variant="label">
                {ptBR.database.retry}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading && transactions.length === 0 ? (
        <View style={styles.loading}>
          <Text accessibilityLiveRegion="polite" tone="secondary">
            {ptBR.database.loading}
          </Text>
        </View>
      ) : (
        <FlashList
          contentContainerStyle={styles.listContent}
          data={rows}
          drawDistance={500}
          extraData={[accountById, categoryById]}
          getItemType={(item) => item.type}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              actionLabel={
                visibleTransactions.length === 0 && transactions.length === 0
                  ? ptBR.transactions.add
                  : undefined
              }
              description={
                transactions.length === 0
                  ? ptBR.transactions.emptyDescription
                  : ptBR.transactions.noResultsDescription
              }
              onAction={openNewForm}
              title={
                transactions.length === 0
                  ? ptBR.transactions.emptyTitle
                  : ptBR.transactions.noResultsTitle
              }
            />
          }
          renderItem={renderRow}
        />
      )}

      {pendingUndo ? (
        <View style={[styles.undoBar, { backgroundColor: colors.surface }]}>
          <Text>{ptBR.transactions.undoTitle}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void undoDelete()}
            style={styles.undoButton}
          >
            <Text tone="primary" variant="label">
              {ptBR.transactions.undo}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {formVisible ? (
        <TransactionFormSheet
          key={editing?.id ?? 'new'}
          accounts={accounts}
          categories={categories}
          onClose={() => {
            setFormVisible(false);
            setEditing(null);
          }}
          onSave={saveTransaction}
          transaction={editing}
        />
      ) : null}
    </Screen>
  );
}

function DateHeader({ date, today }: { date: string; today: string }) {
  const { colors } = useTheme();
  const [year, month, day] = date.split('-').map(Number);
  const previousDate = new Date(year, month - 1, day - 1);
  const yesterday = getLocalDateString(previousDate);
  const label =
    date === today
      ? ptBR.transactions.today
      : date === yesterday
        ? ptBR.transactions.yesterday
        : new Intl.DateTimeFormat('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(new Date(year, month - 1, day));

  return (
    <Text variant="label" style={[styles.dateHeader, { color: colors.textSecondary }]}>
      {label}
    </Text>
  );
}

function TransactionCard({
  transaction,
  account,
  transferAccount,
  category,
  onPress,
}: {
  transaction: Transaction;
  account?: Account;
  transferAccount?: Account;
  category?: Category;
  onPress: () => void;
}) {
  const isExpense = transaction.kind === 'expense';
  const description =
    transaction.kind === 'transfer'
      ? `${account?.name ?? ''} → ${transferAccount?.name ?? ''}`
      : (category?.name ?? account?.name ?? '');

  return (
    <Card
      accessibilityLabel={`${transaction.description}, ${formatSignedAmount(transaction)}, ${description}`}
      onPress={onPress}
      style={styles.transactionCard}
    >
      <View style={styles.transactionInfo}>
        <Text numberOfLines={1} variant="label">
          {transaction.description}
        </Text>
        <Text numberOfLines={1} tone="secondary" variant="caption">
          {description || account?.name || ptBR.transactions.noCategory}
        </Text>
        {!transaction.isPaid ? (
          <Text tone="muted" variant="caption">
            {ptBR.transactions.pending}
          </Text>
        ) : null}
      </View>
      <AmountText
        amountCents={isExpense ? -transaction.amountCents : transaction.amountCents}
        tone={
          transaction.kind === 'income'
            ? 'positive'
            : transaction.kind === 'expense'
              ? 'negative'
              : 'default'
        }
        variant="label"
      />
    </Card>
  );
}

function formatSignedAmount(transaction: Transaction): string {
  const prefix = transaction.kind === 'expense' ? '−' : transaction.kind === 'income' ? '+' : '';
  return `${prefix}${new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(transaction.amountCents / 100)}`;
}

function FilterChip({
  label,
  accessibilityLabel,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.primarySubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text tone={selected ? 'primary' : 'secondary'} variant="caption">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  titleContainer: {
    flex: 1,
  },
  addButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.medium,
    paddingHorizontal: spacing[3],
    marginBottom: spacing[2],
    fontSize: 16,
  },
  filterRow: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
    paddingRight: spacing[2],
  },
  filterChip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  listContent: {
    paddingBottom: spacing[8],
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateHeader: {
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    textTransform: 'capitalize',
  },
  swipeContainer: {
    borderRadius: radius.large,
    marginBottom: spacing[2],
    overflow: 'hidden',
  },
  transactionCard: {
    minHeight: 76,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[3],
    marginBottom: 0,
  },
  transactionInfo: {
    flex: 1,
    gap: spacing[1],
  },
  deleteAction: {
    minWidth: 84,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    borderRadius: radius.medium,
    padding: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[2],
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  undoBar: {
    minHeight: 56,
    borderRadius: radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  undoButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
});
