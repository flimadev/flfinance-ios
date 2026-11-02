import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Link } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CategorySpendingChart } from '@/src/features/dashboard/CategorySpendingChart';
import { DateRangePicker } from '@/src/features/dashboard/DateRangePicker';
import { useDashboard } from '@/src/features/dashboard/useDashboard';
import { getMonthPeriod, summarizeDashboard, type DashboardPeriod } from '@/src/domain/dashboard';
import type { Account, Category, Transaction } from '@/src/db/schema';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, typography, useTheme } from '@/src/theme';
import { AmountText, Button, Card, Screen, Text, formatCurrencyCents } from '@/src/ui';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type PeriodMode = 'current' | 'previous' | 'custom';
type AnimatedTextInputProps = TextInputProps & { text: string };

function formatAnimatedCurrencyCents(amountCents: number): string {
  'worklet';
  const roundedCents = Math.round(amountCents);
  const negative = roundedCents < 0;
  const absoluteCents = Math.abs(roundedCents);
  const wholePart = String(Math.floor(absoluteCents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = String(absoluteCents % 100).padStart(2, '0');
  return `${negative ? '−' : ''}R$ ${wholePart},${cents}`;
}

function AnimatedBalance({ amountCents }: { amountCents: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const animatedAmount = useSharedValue(0);

  useEffect(() => {
    animatedAmount.value = reduceMotion
      ? amountCents
      : withTiming(amountCents, {
          duration: 900,
          easing: Easing.out(Easing.cubic),
        });
  }, [amountCents, animatedAmount, reduceMotion]);

  const animatedProps = useAnimatedProps<AnimatedTextInputProps>(() => ({
    text: formatAnimatedCurrencyCents(animatedAmount.value),
  }));

  return (
    <AnimatedTextInput
      accessibilityLabel={formatCurrencyCents(amountCents)}
      accessibilityLiveRegion="polite"
      animatedProps={animatedProps}
      caretHidden
      defaultValue={formatCurrencyCents(0)}
      editable={false}
      pointerEvents="none"
      selectTextOnFocus={false}
      showSoftInputOnFocus={false}
      style={[
        styles.animatedBalance,
        {
          color: colors.text,
          fontSize: typography.size.display,
          fontWeight: typography.weight.bold,
          lineHeight: typography.lineHeight.display,
        },
      ]}
      underlineColorAndroid="transparent"
    />
  );
}

function getLocalToday(): string {
  const today = new Date();
  const year = String(today.getFullYear()).padStart(4, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day),
  );
}

function getRangeLabel(range: DashboardPeriod): string {
  return `${formatDate(range.fromDate)} – ${formatDate(range.toDate)}`;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { accounts, categories, transactions, loading, error, reload } = useDashboard();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current');
  const [period, setPeriod] = useState<DashboardPeriod>(() => getMonthPeriod(new Date()));
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const summary = useMemo(
    () => summarizeDashboard(accounts, categories, transactions, period, getLocalToday()),
    [accounts, categories, period, transactions],
  );

  function choosePreset(mode: Exclude<PeriodMode, 'custom'>) {
    setPeriodMode(mode);
    setPeriod(getMonthPeriod(new Date(), mode === 'current' ? 0 : -1));
  }

  function applyCustomPeriod(range: DashboardPeriod) {
    setPeriod(range);
    setPeriodMode('custom');
    setDatePickerVisible(false);
  }

  const periodLabel =
    periodMode === 'current'
      ? ptBR.dashboard.currentMonth
      : periodMode === 'previous'
        ? ptBR.dashboard.previousMonth
        : getRangeLabel(period);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  return (
    <Screen contentContainerStyle={styles.content} scrollable testID="dashboard-screen">
      <View style={styles.header}>
        <Text variant="title">{ptBR.dashboard.title}</Text>
      </View>

      <View
        accessibilityLabel={ptBR.dashboard.periodAccessibility(periodLabel)}
        style={styles.periodSelector}
      >
        <PeriodButton
          label={ptBR.dashboard.currentMonth}
          selected={periodMode === 'current'}
          onPress={() => choosePreset('current')}
        />
        <PeriodButton
          label={ptBR.dashboard.previousMonth}
          selected={periodMode === 'previous'}
          onPress={() => choosePreset('previous')}
        />
        <PeriodButton
          label={ptBR.dashboard.customPeriod}
          selected={periodMode === 'custom'}
          onPress={() => setDatePickerVisible(true)}
        />
      </View>
      {periodMode === 'custom' ? (
        <Text style={styles.customRange} variant="caption" tone="secondary">
          {getRangeLabel(period)}
        </Text>
      ) : null}
      {error ? (
        <Card style={styles.errorContent}>
          <Text accessibilityRole="alert" tone="negative">
            {error}
          </Text>
          <Button haptic={false} onPress={() => void reload()}>
            {ptBR.dashboard.retry}
          </Button>
        </Card>
      ) : null}

      <Card style={[styles.balanceCard, { backgroundColor: colors.primarySubtle }]}>
        <Text tone="secondary" variant="label">
          {ptBR.dashboard.balance}
        </Text>
        <AnimatedBalance amountCents={summary.balanceCents} />
        <Text tone="muted" variant="caption">
          {ptBR.dashboard.balanceHint}
        </Text>
      </Card>

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text tone="secondary" variant="caption">
            {ptBR.dashboard.incomeInPeriod}
          </Text>
          <AmountText
            amountCents={summary.incomeCents}
            numberOfLines={1}
            tone="positive"
            variant="heading"
          />
        </Card>
        <Card style={styles.summaryCard}>
          <Text tone="secondary" variant="caption">
            {ptBR.dashboard.expensesInPeriod}
          </Text>
          <AmountText
            amountCents={-summary.expenseCents}
            numberOfLines={1}
            tone="negative"
            variant="heading"
          />
        </Card>
      </View>

      <Card style={styles.sectionCard}>
        <Text variant="heading">{ptBR.dashboard.categorySpending}</Text>
        <CategorySpendingChart categories={summary.categories} totalCents={summary.expenseCents} />
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text variant="heading">{ptBR.dashboard.recentTransactions}</Text>
          <Link href="/(tabs)/transactions" asChild>
            <Button haptic={false} style={styles.viewAllButton} variant="ghost">
              {ptBR.dashboard.viewAll}
            </Button>
          </Link>
        </View>
        {loading && transactions.length === 0 ? (
          <ActivityIndicator
            accessibilityLabel={ptBR.dashboard.loading}
            color={colors.primary}
            style={styles.loader}
          />
        ) : error && transactions.length === 0 ? (
          <Text tone="secondary">{ptBR.dashboard.noRecentTransactions}</Text>
        ) : summary.recentTransactions.length ? (
          summary.recentTransactions.map((transaction) => (
            <DashboardTransactionRow
              account={accountById.get(transaction.accountId)}
              category={
                transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined
              }
              key={transaction.id}
              transaction={transaction}
            />
          ))
        ) : (
          <Text tone="secondary">{ptBR.dashboard.noRecentTransactions}</Text>
        )}
      </Card>

      {datePickerVisible ? (
        <DateRangePicker
          initialRange={period}
          onApply={applyCustomPeriod}
          onCancel={() => setDatePickerVisible(false)}
        />
      ) : null}
    </Screen>
  );
}

function PeriodButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.periodButton,
        {
          backgroundColor: selected ? colors.primarySubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: selected ? colors.primary : colors.textSecondary }}
        variant="caption"
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DashboardTransactionRow({
  transaction,
  account,
  category,
}: {
  transaction: Transaction;
  account?: Account;
  category?: Category;
}) {
  const { colors } = useTheme();
  const subtitle =
    transaction.kind === 'transfer'
      ? ptBR.dashboard.transfer
      : (category?.name ?? account?.name ?? ptBR.transactions.noCategory);
  const signedAmount =
    transaction.kind === 'expense' ? -transaction.amountCents : transaction.amountCents;
  const accessibilityLabel = [
    transaction.description,
    formatCurrencyCents(signedAmount),
    subtitle,
    formatDate(transaction.date),
    transaction.isPaid ? undefined : ptBR.dashboard.pending,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible
      style={[styles.transactionRow, { borderTopColor: colors.border }]}
    >
      <View style={styles.transactionInfo}>
        <Text numberOfLines={1} variant="label">
          {transaction.description}
        </Text>
        <Text numberOfLines={1} tone="secondary" variant="caption">
          {subtitle} · {formatDate(transaction.date)}
          {!transaction.isPaid ? ` · ${ptBR.dashboard.pending}` : ''}
        </Text>
      </View>
      <AmountText
        amountCents={signedAmount}
        tone={
          transaction.kind === 'income'
            ? 'positive'
            : transaction.kind === 'expense'
              ? 'negative'
              : 'default'
        }
        variant="label"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  periodButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[2],
  },
  customRange: {
    marginTop: -spacing[3],
  },
  balanceCard: {
    gap: spacing[2],
  },
  animatedBalance: {
    padding: 0,
    textAlign: 'left',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  summaryCard: {
    flex: 1,
    gap: spacing[2],
    minWidth: 0,
    padding: spacing[4],
  },
  sectionCard: {
    gap: spacing[3],
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewAllButton: {
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[2],
  },
  loader: {
    minHeight: spacing[12],
  },
  errorContent: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  transactionRow: {
    alignItems: 'center',
    borderTopWidth: layout.borderWidth,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: layout.touchTarget,
    paddingVertical: spacing[2],
  },
  transactionInfo: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
});
