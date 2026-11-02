import { FlashList } from '@shopify/flash-list';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AmountText, Button, Card, EmptyState, Screen, Text } from '@/src/ui';
import { ptBR } from '@/src/i18n/pt-BR';
import {
  getLocalDateString,
  groupTransactionsByDate,
  normalizeSearchText,
  type TransactionRow,
} from '@/src/domain/transactions';
import type { Account, Category, Transaction } from '@/src/db/schema';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { TransactionFormSheet } from '@/src/features/transactions/TransactionFormSheet';
import { useTransactions } from '@/src/features/transactions/useTransactions';
import type { TransactionFormInput } from '@/src/features/transactions/transactionFormTypes';
import { useModalAnimationType } from '@/src/ui/useModalAnimationType';

type KindFilter = 'all' | Transaction['kind'];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const modalAnimationType = useModalAnimationType();
  const {
    accounts,
    categories,
    transactions,
    tags,
    transactionTags,
    attachments,
    loading,
    error,
    reminderError,
    reload,
    create,
    update,
    remove,
    restore,
    saveExtras,
  } = useTransactions();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [filtersVisible, setFiltersVisible] = useState(false);
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
  const taggedTransactionIds = useMemo(
    () =>
      new Set(
        transactionTags
          .filter((relation) => !tagFilter || relation.tagId === tagFilter)
          .map((relation) => relation.transactionId),
      ),
    [tagFilter, transactionTags],
  );

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
        if (tagFilter && !taggedTransactionIds.has(transaction.id)) {
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
      tagFilter,
      taggedTransactionIds,
      transactions,
    ],
  );
  const rows = useMemo(() => groupTransactionsByDate(visibleTransactions), [visibleTransactions]);
  const summaryTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => period === 'all' || transaction.date.slice(0, 7) === selectedMonth,
      ),
    [period, selectedMonth, transactions],
  );
  const summary = useMemo(
    () =>
      summaryTransactions.reduce(
        (totals, transaction) => {
          if (transaction.kind === 'expense') {
            totals.expenses += transaction.amountCents;
          } else if (transaction.kind === 'income') {
            totals.income += transaction.amountCents;
          }
          return totals;
        },
        { expenses: 0, income: 0 },
      ),
    [summaryTransactions],
  );
  const activeFilterCount =
    Number(Boolean(accountFilter)) + Number(Boolean(categoryFilter)) + Number(Boolean(tagFilter));

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

  async function saveTransaction(input: TransactionFormInput, retryTransactionId?: string) {
    if (retryTransactionId) return update(retryTransactionId, input);
    if (editing) {
      return update(editing.id, input);
    }
    return create(input);
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
      <View style={styles.content}>
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
            {ptBR.transactions.addShort}
          </Button>
        </View>

        <View
          style={[
            styles.periodControl,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            accessibilityLabel={ptBR.transactions.previousMonth}
            accessibilityRole="button"
            onPress={() => {
              setMonthOffset((offset) => offset - 1);
              setPeriod('month');
            }}
            style={styles.monthButton}
          >
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              tintColor={colors.text}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: period === 'month' }}
            onPress={() => setPeriod('month')}
            style={styles.periodLabel}
          >
            <Text numberOfLines={1} variant="label">
              {period === 'month' ? monthLabel : ptBR.transactions.allTime}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={ptBR.transactions.nextMonth}
            accessibilityRole="button"
            accessibilityState={{ disabled: monthOffset >= 0 }}
            disabled={monthOffset >= 0}
            onPress={() => {
              setMonthOffset((offset) => Math.min(offset + 1, 0));
              setPeriod('month');
            }}
            style={[styles.monthButton, monthOffset >= 0 && styles.disabledControl]}
          >
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18}
              tintColor={colors.text}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: period === 'all' }}
            onPress={() => setPeriod('all')}
            style={[
              styles.allTimeButton,
              {
                backgroundColor: period === 'all' ? colors.primarySubtle : colors.surfaceSubtle,
              },
            ]}
          >
            <Text tone={period === 'all' ? 'primary' : 'secondary'} variant="caption">
              {ptBR.transactions.allTime}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.summaryHeader}>
            <View style={[styles.summaryAccent, { backgroundColor: colors.primary }]} />
            <Text tone="secondary" variant="label">
              {ptBR.transactions.periodSummary(
                period === 'month' ? monthLabel : ptBR.transactions.allTime,
              )}
            </Text>
          </View>
          <View style={styles.summaryMetrics}>
            <View style={styles.primaryMetric}>
              <Text tone="secondary" variant="caption">
                {ptBR.transactions.expenseTotal}
              </Text>
              <AmountText
                amountCents={summary.expenses ? -summary.expenses : 0}
                tone={summary.expenses ? 'negative' : 'default'}
                variant="heading"
              />
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
            <View style={styles.secondaryMetric}>
              <Text tone="secondary" variant="caption">
                {ptBR.transactions.incomeTotal}
              </Text>
              <AmountText amountCents={summary.income} tone="positive" variant="heading" />
            </View>
          </View>
        </View>

        <View style={styles.searchFilterRow}>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={18}
              tintColor={colors.textMuted}
            />
            <TextInput
              accessibilityLabel={ptBR.transactions.searchPlaceholder}
              onChangeText={setQuery}
              placeholder={ptBR.transactions.searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              selectionColor={colors.primary}
              style={[styles.search, { color: colors.text }]}
              value={query}
            />
          </View>
          <Pressable
            accessibilityLabel={ptBR.transactions.filtersCount(activeFilterCount)}
            accessibilityRole="button"
            onPress={() => setFiltersVisible(true)}
            style={[
              styles.filterButton,
              {
                backgroundColor: activeFilterCount ? colors.primarySubtle : colors.surface,
                borderColor: activeFilterCount ? colors.primary : colors.border,
              },
            ]}
          >
            <SymbolView
              name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
              size={19}
              tintColor={activeFilterCount ? colors.primary : colors.text}
            />
            {activeFilterCount ? (
              <Text tone="primary" variant="caption">
                {activeFilterCount}
              </Text>
            ) : null}
          </Pressable>
        </View>

        <View
          accessibilityLabel={ptBR.transactions.activity}
          accessibilityRole="tablist"
          style={[styles.kindFilters, { backgroundColor: colors.surfaceSubtle }]}
        >
          <FilterChip
            label={ptBR.transactions.typeAll}
            onPress={() => setKindFilter('all')}
            selected={kindFilter === 'all'}
            segment
          />
          <FilterChip
            label={ptBR.transactions.typeExpense}
            onPress={() => setKindFilter('expense')}
            selected={kindFilter === 'expense'}
            segment
          />
          <FilterChip
            label={ptBR.transactions.typeIncome}
            onPress={() => setKindFilter('income')}
            selected={kindFilter === 'income'}
            segment
          />
          <FilterChip
            accessibilityLabel={ptBR.transactions.typeTransfer}
            label={ptBR.transactions.typeTransferShort}
            onPress={() => setKindFilter('transfer')}
            selected={kindFilter === 'transfer'}
            segment
          />
        </View>

        {error || mutationError || reminderError ? (
          <View
            accessibilityRole="alert"
            style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle }]}
          >
            <Text tone="negative">{mutationError ?? error ?? reminderError}</Text>
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
            style={styles.transactionsList}
            extraData={[accountById, categoryById]}
            getItemType={(item) => item.type}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.listHeading}>
                <Text variant="heading">{ptBR.transactions.activity}</Text>
                <Text tone="secondary" variant="caption">
                  {ptBR.transactions.transactionCount(visibleTransactions.length)}
                </Text>
              </View>
            }
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
            showsVerticalScrollIndicator={false}
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

        <Modal
          animationType={modalAnimationType}
          onRequestClose={() => setFiltersVisible(false)}
          presentationStyle="pageSheet"
          visible={filtersVisible}
        >
          <View style={[styles.filterSheet, { backgroundColor: colors.background }]}>
            <View style={styles.filterSheetHeader}>
              <View>
                <Text variant="heading">{ptBR.transactions.filters}</Text>
                <Text tone="secondary" variant="caption">
                  {ptBR.transactions.filterDescription}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={ptBR.transactions.closeFilters}
                accessibilityRole="button"
                onPress={() => setFiltersVisible(false)}
                style={styles.closeFiltersButton}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={18}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.filterGroups}
              showsVerticalScrollIndicator={false}
            >
              {activeAccounts.length > 1 ? (
                <View style={styles.modalFilterGroup}>
                  <Text variant="label">{ptBR.transactions.account}</Text>
                  <View style={styles.modalChoices}>
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
                  </View>
                </View>
              ) : null}
              {activeCategories.length ? (
                <View style={styles.modalFilterGroup}>
                  <Text variant="label">{ptBR.transactions.category}</Text>
                  <View style={styles.modalChoices}>
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
                  </View>
                </View>
              ) : null}
              {tags.length > 0 ? (
                <View style={styles.modalFilterGroup}>
                  <Text variant="label">{ptBR.transactions.tags}</Text>
                  <View style={styles.modalChoices}>
                    <FilterChip
                      label={ptBR.transactions.allTags}
                      onPress={() => setTagFilter('')}
                      selected={!tagFilter}
                    />
                    {tags.map((tag) => (
                      <FilterChip
                        key={tag.id}
                        label={tag.name}
                        onPress={() => setTagFilter(tag.id)}
                        selected={tagFilter === tag.id}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.filterActions}>
              <Button
                haptic={false}
                onPress={() => {
                  setAccountFilter('');
                  setCategoryFilter('');
                  setTagFilter('');
                }}
                variant="secondary"
              >
                {ptBR.transactions.clearFilters}
              </Button>
              <Button haptic={false} onPress={() => setFiltersVisible(false)}>
                {ptBR.transactions.applyFilters}
              </Button>
            </View>
          </View>
        </Modal>

        {formVisible ? (
          <TransactionFormSheet
            key={editing?.id ?? 'new'}
            accounts={accounts}
            categories={categories}
            tags={tags}
            transactionTagIds={
              editing
                ? transactionTags
                    .filter((relation) => relation.transactionId === editing.id)
                    .map((relation) => relation.tagId)
                : []
            }
            attachments={
              editing
                ? attachments.filter((attachment) => attachment.transactionId === editing.id)
                : []
            }
            onClose={() => {
              setFormVisible(false);
              setEditing(null);
            }}
            onSave={saveTransaction}
            onSaveExtras={saveExtras}
            transaction={editing}
          />
        ) : null}
      </View>
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
  const { colors } = useTheme();
  const isExpense = transaction.kind === 'expense';
  const tone =
    transaction.kind === 'income'
      ? 'positive'
      : transaction.kind === 'expense'
        ? 'negative'
        : 'default';
  const description =
    transaction.kind === 'transfer'
      ? `${account?.name ?? ''} → ${transferAccount?.name ?? ''}`
      : `${category?.name ?? ptBR.transactions.noCategory} · ${account?.name ?? ''}`;
  const icon: SymbolViewProps['name'] =
    transaction.kind === 'income'
      ? { ios: 'arrow.down.left', android: 'south_west', web: 'south_west' }
      : transaction.kind === 'expense'
        ? { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }
        : { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' };
  const iconBackground =
    transaction.kind === 'income'
      ? colors.positiveSubtle
      : transaction.kind === 'expense'
        ? colors.negativeSubtle
        : colors.surfaceSubtle;
  const iconColor =
    transaction.kind === 'income'
      ? colors.positive
      : transaction.kind === 'expense'
        ? colors.negative
        : colors.textSecondary;
  const paymentMethod =
    transaction.paymentMethod === 'transfer'
      ? ptBR.transactions.transfer
      : transaction.paymentMethod
        ? ptBR.transactions.methods[transaction.paymentMethod]
        : null;

  return (
    <Card
      accessibilityLabel={[
        transaction.description,
        formatSignedAmount(transaction),
        description,
        !transaction.isPaid ? ptBR.transactions.pending : '',
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={styles.transactionCard}
    >
      <View style={[styles.transactionIcon, { backgroundColor: iconBackground }]}>
        <SymbolView name={icon} size={19} tintColor={iconColor} />
      </View>
      <View style={styles.transactionInfo}>
        <Text numberOfLines={1} variant="label">
          {transaction.description}
        </Text>
        <Text numberOfLines={1} tone="secondary" variant="caption">
          {description}
        </Text>
        <View style={styles.transactionMeta}>
          {!transaction.isPaid ? (
            <View style={[styles.pendingBadge, { backgroundColor: colors.negativeSubtle }]}>
              <Text tone="negative" variant="caption">
                {ptBR.transactions.pending}
              </Text>
            </View>
          ) : null}
          {paymentMethod ? (
            <Text numberOfLines={1} tone="muted" variant="caption">
              {ptBR.transactions.paymentMethodLabel(paymentMethod)}
            </Text>
          ) : null}
        </View>
      </View>
      <AmountText
        amountCents={isExpense ? -transaction.amountCents : transaction.amountCents}
        tone={tone}
        variant="label"
        style={styles.transactionAmount}
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
  segment = false,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  disabled?: boolean;
  segment?: boolean;
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
        segment ? styles.segmentChip : styles.filterChip,
        {
          backgroundColor: segment
            ? selected
              ? colors.primary
              : 'transparent'
            : selected
              ? colors.primarySubtle
              : colors.surface,
          borderColor: segment
            ? selected
              ? colors.primary
              : 'transparent'
            : selected
              ? colors.primary
              : colors.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        tone={!segment && selected ? 'primary' : 'secondary'}
        variant="caption"
        style={segment && selected ? { color: colors.onPrimary } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: spacing[3],
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  titleContainer: {
    flex: 1,
    gap: spacing[1],
  },
  addButton: {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    paddingHorizontal: spacing[4],
  },
  periodControl: {
    alignItems: 'center',
    borderRadius: radius.large,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    padding: spacing[1],
  },
  monthButton: {
    alignItems: 'center',
    height: layout.touchTarget,
    justifyContent: 'center',
    width: layout.touchTarget,
  },
  periodLabel: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[2],
  },
  allTimeButton: {
    alignItems: 'center',
    borderRadius: radius.medium,
    justifyContent: 'center',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[3],
  },
  disabledControl: {
    opacity: 0.4,
  },
  summaryCard: {
    borderRadius: radius.large,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  summaryAccent: {
    borderRadius: radius.pill,
    height: spacing[4],
    width: spacing[1],
  },
  summaryMetrics: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[4],
  },
  primaryMetric: {
    flex: 1,
    gap: spacing[1],
  },
  secondaryMetric: {
    flex: 1,
    gap: spacing[1],
  },
  metricDivider: {
    height: spacing[10],
    width: 1,
  },
  searchFilterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchContainer: {
    alignItems: 'center',
    borderRadius: radius.medium,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  search: {
    flex: 1,
    minHeight: 48,
    fontSize: 16,
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    height: 48,
    justifyContent: 'center',
    minWidth: layout.touchTarget,
    paddingHorizontal: spacing[2],
  },
  kindFilters: {
    alignItems: 'center',
    borderRadius: radius.medium,
    flexDirection: 'row',
    gap: spacing[1],
    minHeight: 48,
    padding: spacing[1],
  },
  filterChip: {
    minHeight: layout.touchTarget,
    borderWidth: 1,
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  segmentChip: {
    alignItems: 'center',
    borderRadius: radius.small,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: spacing[10],
    paddingHorizontal: spacing[1],
  },
  listContent: {
    paddingBottom: spacing[4],
  },
  transactionsList: {
    flex: 1,
  },
  listHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
    paddingTop: spacing[2],
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateHeader: {
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    textTransform: 'capitalize',
  },
  swipeContainer: {
    borderRadius: radius.medium,
    marginBottom: spacing[2],
    overflow: 'hidden',
  },
  transactionCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: 80,
    padding: spacing[3],
  },
  transactionIcon: {
    alignItems: 'center',
    borderRadius: radius.medium,
    height: spacing[12],
    justifyContent: 'center',
    width: spacing[12],
  },
  transactionInfo: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  transactionMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: spacing[4],
  },
  pendingBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2],
  },
  transactionAmount: {
    flexShrink: 0,
    textAlign: 'right',
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
  filterSheet: {
    flex: 1,
    gap: spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
  },
  filterSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeFiltersButton: {
    alignItems: 'center',
    height: layout.touchTarget,
    justifyContent: 'center',
    width: layout.touchTarget,
  },
  modalFilterGroup: {
    gap: spacing[2],
  },
  filterGroups: {
    flexGrow: 1,
    gap: spacing[4],
  },
  modalChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: 'auto',
  },
});
