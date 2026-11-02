import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateRangePicker } from '@/src/features/dashboard/DateRangePicker';
import { useReports } from '@/src/features/reports/useReports';
import { exportReportPdf, exportReportXlsx } from '@/src/services/ReportExportService';
import type {
  FinancialReportCategory,
  FinancialReportFilters,
  FinancialReportTransaction,
  ReportKindFilter,
} from '@/src/domain/reports';
import { getMonthPeriod, type DashboardPeriod } from '@/src/domain/dashboard';
import { formatCurrencyCents } from '@/src/domain/money';
import { ptBR } from '@/src/i18n/pt-BR';
import { useAppPreferences } from '@/src/preferences/AppPreferencesProvider';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { AmountText, Button, Card, Screen, Text } from '@/src/ui';

type PeriodMode = 'month' | 'threeMonths' | 'twelveMonths' | 'custom';
type ExportFormat = 'pdf' | 'xlsx';
type FilterChoice = { id: string; label: string };

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1),
  );
}

function getPeriod(mode: PeriodMode, customPeriod: DashboardPeriod, monthStartDay: number) {
  if (mode === 'custom') {
    return customPeriod;
  }
  const current = getMonthPeriod(new Date(), 0, monthStartDay);
  if (mode === 'month') {
    return current;
  }
  const firstMonth = getMonthPeriod(new Date(), mode === 'threeMonths' ? -2 : -11, monthStartDay);
  return { fromDate: firstMonth.fromDate, toDate: current.toDate };
}

function getSignedAmount(transaction: FinancialReportTransaction['transaction']): number {
  return transaction.kind === 'expense' ? -transaction.amountCents : transaction.amountCents;
}

function getExportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'report-export-unavailable') {
    return ptBR.reports.exportUnavailable;
  }
  return ptBR.reports.exportError;
}

export default function ReportsScreen() {
  const { colors } = useTheme();
  const { preferences } = useAppPreferences();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [customPeriod, setCustomPeriod] = useState<DashboardPeriod>(() =>
    getMonthPeriod(new Date(), 0, preferences.monthStartDay),
  );
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [tagId, setTagId] = useState<string | null>(null);
  const [kind, setKind] = useState<ReportKindFilter>('all');
  const [expandedCategory, setExpandedCategory] = useState<FinancialReportCategory | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const period = useMemo(
    () => getPeriod(periodMode, customPeriod, preferences.monthStartDay),
    [customPeriod, periodMode, preferences.monthStartDay],
  );
  const filters = useMemo<FinancialReportFilters>(
    () => ({ period, accountId, categoryId, uncategorizedOnly, tagId, kind }),
    [accountId, categoryId, kind, period, tagId, uncategorizedOnly],
  );
  const { accounts, categories, error, loading, report, reportError, reload, tags } =
    useReports(filters);

  const visibleAccounts = accounts.filter((account) => account.deletedAt === null);
  const visibleCategories = categories.filter((category) => category.deletedAt === null);
  const visibleTags = tags;
  const detailTransactions =
    expandedCategory && report
      ? report.transactions.filter(
          ({ transaction }) =>
            transaction.categoryId === expandedCategory.categoryId &&
            transaction.kind === expandedCategory.kind,
        )
      : [];
  const periodLabel = `${formatDate(period.fromDate)} – ${formatDate(period.toDate)}`;
  const filterLabels = [
    accountId
      ? visibleAccounts.find((account) => account.id === accountId)?.name
      : ptBR.reports.allAccounts,
    uncategorizedOnly
      ? ptBR.reports.uncategorized
      : categoryId
        ? visibleCategories.find((category) => category.id === categoryId)?.name
        : ptBR.reports.allCategories,
    tagId ? visibleTags.find((tag) => tag.id === tagId)?.name : ptBR.reports.allTags,
    kind === 'all'
      ? ptBR.reports.allKinds
      : kind === 'expense'
        ? ptBR.reports.expense
        : kind === 'income'
          ? ptBR.reports.income
          : ptBR.reports.transfer,
  ].filter((label): label is string => label !== undefined);
  const labels = {
    title: ptBR.reports.pdfTitle,
    periodLabel: ptBR.reports.periodLabel,
    period: periodLabel,
    filtersLabel: ptBR.reports.filtersLabel,
    filters: filterLabels.join(' · '),
    summary: ptBR.reports.summary,
    income: ptBR.reports.income,
    expense: ptBR.reports.expense,
    net: ptBR.reports.net,
    projectedBalance: ptBR.reports.projectedBalance,
    monthlyEvolution: ptBR.reports.monthlyEvolution,
    month: ptBR.reports.month,
    categoryBreakdown: ptBR.reports.categoryBreakdown,
    category: ptBR.reports.category,
    kind: ptBR.reports.kind,
    expenseKind: ptBR.reports.categoryKindExpense,
    incomeKind: ptBR.reports.categoryKindIncome,
    transactions: ptBR.reports.transactionDetails,
    date: ptBR.reports.date,
    description: ptBR.reports.descriptionLabel,
    account: ptBR.reports.account,
    destinationAccount: ptBR.reports.destinationAccount,
    tags: ptBR.reports.tags,
    amount: ptBR.reports.amount,
    amountCents: ptBR.reports.amountCents,
    status: ptBR.reports.status,
    paid: ptBR.reports.paid,
    pending: ptBR.reports.pending,
    transfer: ptBR.reports.transfer,
    uncategorized: ptBR.reports.uncategorized,
    workbookSummary: ptBR.reports.workbookSummary,
    workbookMonthly: ptBR.reports.workbookMonthly,
    workbookCategories: ptBR.reports.workbookCategories,
    workbookTransactions: ptBR.reports.workbookTransactions,
  };

  async function shareReport(format: ExportFormat) {
    if (!report) {
      return;
    }
    setExporting(format);
    setExportError(null);
    setExportSuccess(false);
    try {
      if (format === 'pdf') {
        await exportReportPdf(report, labels);
      } else {
        await exportReportXlsx(report, labels);
      }
      setExportSuccess(true);
    } catch (exportFailure) {
      console.error(`Não foi possível exportar o relatório em ${format}.`, exportFailure);
      setExportError(getExportErrorMessage(exportFailure));
    } finally {
      setExporting(null);
    }
  }

  function applyCustomPeriod(range: DashboardPeriod) {
    setCustomPeriod(range);
    setPeriodMode('custom');
    setDatePickerVisible(false);
  }

  function selectCategory(category: FinancialReportCategory) {
    setExpandedCategory((current) =>
      current?.categoryId === category.categoryId && current.kind === category.kind
        ? null
        : category,
    );
  }

  const header = (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text variant="title">{ptBR.reports.title}</Text>
          <Text tone="secondary" variant="caption">
            {ptBR.reports.description}
          </Text>
        </View>
        <Button haptic={false} onPress={() => router.back()} variant="secondary">
          {ptBR.dashboard.back}
        </Button>
      </View>

      <View style={styles.periodSelector}>
        <ChoiceChip
          label={ptBR.reports.thisMonth}
          selected={periodMode === 'month'}
          onPress={() => setPeriodMode('month')}
        />
        <ChoiceChip
          label={ptBR.reports.lastThreeMonths}
          selected={periodMode === 'threeMonths'}
          onPress={() => setPeriodMode('threeMonths')}
        />
        <ChoiceChip
          label={ptBR.reports.lastTwelveMonths}
          selected={periodMode === 'twelveMonths'}
          onPress={() => setPeriodMode('twelveMonths')}
        />
      </View>
      <View style={styles.customPeriodRow}>
        <Text tone="secondary" variant="caption">
          {periodLabel}
        </Text>
        <Button
          haptic={false}
          onPress={() => setDatePickerVisible(true)}
          style={styles.customPeriodButton}
          variant="ghost"
        >
          {ptBR.reports.customPeriod}
        </Button>
      </View>

      <FilterGroup
        title={ptBR.reports.accountFilter}
        choices={[
          { id: 'all', label: ptBR.reports.allAccounts },
          ...visibleAccounts.map((account) => ({ id: account.id, label: account.name })),
        ]}
        selectedId={accountId ?? 'all'}
        onChange={(id) => setAccountId(id === 'all' ? null : id)}
      />
      <FilterGroup
        title={ptBR.reports.categoryFilter}
        choices={[
          { id: 'all', label: ptBR.reports.allCategories },
          { id: 'uncategorized', label: ptBR.reports.uncategorized },
          ...visibleCategories.map((category) => ({ id: category.id, label: category.name })),
        ]}
        selectedId={uncategorizedOnly ? 'uncategorized' : (categoryId ?? 'all')}
        onChange={(id) => {
          setUncategorizedOnly(id === 'uncategorized');
          setCategoryId(id === 'all' || id === 'uncategorized' ? null : id);
        }}
      />
      <FilterGroup
        title={ptBR.reports.tagFilter}
        choices={[
          { id: 'all', label: ptBR.reports.allTags },
          ...visibleTags.map((tag) => ({ id: tag.id, label: tag.name })),
        ]}
        selectedId={tagId ?? 'all'}
        onChange={(id) => setTagId(id === 'all' ? null : id)}
      />
      <FilterGroup
        title={ptBR.reports.kindFilter}
        choices={[
          { id: 'all', label: ptBR.reports.allKinds },
          { id: 'expense', label: ptBR.reports.expense },
          { id: 'income', label: ptBR.reports.income },
          { id: 'transfer', label: ptBR.reports.transfer },
        ]}
        selectedId={kind}
        onChange={(id) => {
          if (id === 'all' || id === 'expense' || id === 'income' || id === 'transfer') {
            setKind(id);
          }
        }}
      />

      {error ? (
        <Card style={styles.errorCard}>
          <Text accessibilityRole="alert" tone="negative">
            {ptBR.reports.loadError}: {error}
          </Text>
          <Button haptic={false} onPress={() => void reload()} variant="secondary">
            {ptBR.reports.retry}
          </Button>
        </Card>
      ) : null}
      {reportError ? (
        <Card style={styles.errorCard}>
          <Text accessibilityRole="alert" tone="negative">
            {reportError}
          </Text>
        </Card>
      ) : null}
      {loading && !report ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel={ptBR.reports.loading} color={colors.primary} />
          <Text accessibilityRole="progressbar">{ptBR.reports.loading}</Text>
        </View>
      ) : null}

      {report ? (
        <>
          <View style={styles.summaryRow}>
            <SummaryCard
              label={ptBR.reports.income}
              amountCents={report.incomeCents}
              tone="positive"
            />
            <SummaryCard
              label={ptBR.reports.expense}
              amountCents={-report.expenseCents}
              tone="negative"
            />
          </View>
          <View style={styles.summaryRow}>
            <SummaryCard label={ptBR.reports.net} amountCents={report.netCents} />
            <SummaryCard
              label={ptBR.reports.projectedBalance}
              amountCents={report.projectedBalanceCents}
            />
          </View>

          <Card style={styles.sectionCard}>
            <Text variant="heading">{ptBR.reports.monthlyEvolution}</Text>
            <MonthlyEvolution months={report.months} />
          </Card>

          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text variant="heading">{ptBR.reports.categoryBreakdown}</Text>
              <Text tone="secondary" variant="caption">
                {ptBR.reports.openDetails}
              </Text>
            </View>
            {report.categories.length ? (
              report.categories.map((category) => (
                <CategoryRow
                  category={category}
                  key={`${category.kind}:${category.categoryId ?? 'uncategorized'}`}
                  selected={
                    expandedCategory?.categoryId === category.categoryId &&
                    expandedCategory.kind === category.kind
                  }
                  onPress={() => selectCategory(category)}
                />
              ))
            ) : (
              <Text tone="secondary">{ptBR.reports.noCategories}</Text>
            )}
          </Card>

          {expandedCategory ? (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <Text variant="heading">{ptBR.reports.transactionDetails}</Text>
                <Button
                  haptic={false}
                  onPress={() => setExpandedCategory(null)}
                  style={styles.closeDetailsButton}
                  variant="ghost"
                >
                  {ptBR.reports.closeDetails}
                </Button>
              </View>
              <Text tone="secondary" variant="caption">
                {expandedCategory.name}
              </Text>
            </Card>
          ) : null}

          <View style={styles.exportSection}>
            <View style={styles.exportButtons}>
              <Button
                disabled={!report || exporting !== null}
                loading={exporting === 'pdf'}
                onPress={() => void shareReport('pdf')}
                style={styles.exportButton}
                variant="secondary"
              >
                {ptBR.reports.exportPdf}
              </Button>
              <Button
                disabled={!report || exporting !== null}
                loading={exporting === 'xlsx'}
                onPress={() => void shareReport('xlsx')}
                style={styles.exportButton}
                variant="secondary"
              >
                {ptBR.reports.exportExcel}
              </Button>
            </View>
            {exportError ? (
              <Text accessibilityRole="alert" tone="negative">
                {exportError}
              </Text>
            ) : exportSuccess ? (
              <Text accessibilityLiveRegion="polite" tone="positive">
                {ptBR.reports.exportReady}
              </Text>
            ) : Platform.OS === 'web' ? (
              <Text tone="muted" variant="caption">
                {ptBR.reports.exportUnavailable}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <Screen testID="reports-screen">
      <FlashList
        contentContainerStyle={styles.listContent}
        data={detailTransactions}
        keyExtractor={({ transaction }) => transaction.id}
        ListEmptyComponent={
          expandedCategory ? (
            <Text style={styles.emptyDetails} tone="secondary">
              {ptBR.reports.noDetails}
            </Text>
          ) : null
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => <TransactionRow item={item} />}
        showsVerticalScrollIndicator={false}
      />
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

function FilterGroup({
  title,
  choices,
  selectedId,
  onChange,
}: {
  title: string;
  choices: FilterChoice[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text variant="label">{title}</Text>
      <ScrollView
        contentContainerStyle={styles.filterChoices}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {choices.map((choice) => (
          <ChoiceChip
            key={choice.id}
            label={choice.label}
            selected={choice.id === selectedId}
            onPress={() => onChange(choice.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ChoiceChip({
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
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text numberOfLines={1} style={{ color: selected ? colors.primary : colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryCard({
  label,
  amountCents,
  tone = 'default',
}: {
  label: string;
  amountCents: number;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <Card style={styles.summaryCard}>
      <Text numberOfLines={2} tone="secondary" variant="caption">
        {label}
      </Text>
      <AmountText amountCents={amountCents} numberOfLines={1} tone={tone} variant="label" />
    </Card>
  );
}

function MonthlyEvolution({
  months,
}: {
  months: { month: string; incomeCents: number; expenseCents: number }[];
}) {
  const { colors } = useTheme();
  const maxAmount = Math.max(
    1,
    ...months.flatMap((month) => [month.incomeCents, month.expenseCents]),
  );
  if (!months.some((month) => month.incomeCents > 0 || month.expenseCents > 0)) {
    return <Text tone="secondary">{ptBR.reports.noTransactions}</Text>;
  }
  return (
    <View style={styles.monthList}>
      {months.map((month) => (
        <View key={month.month} style={styles.monthRow}>
          <Text style={styles.monthLabel} tone="secondary" variant="caption">
            {formatMonth(month.month)}
          </Text>
          <View style={styles.monthBars}>
            <View
              accessibilityLabel={`${ptBR.reports.income}: ${formatCurrencyCents(month.incomeCents)}`}
              style={[styles.barTrack, { backgroundColor: colors.background }]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: colors.positive,
                    width: `${(month.incomeCents / maxAmount) * 100}%`,
                  },
                ]}
              />
            </View>
            <View
              accessibilityLabel={`${ptBR.reports.expense}: ${formatCurrencyCents(month.expenseCents)}`}
              style={[styles.barTrack, { backgroundColor: colors.background }]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: colors.negative,
                    width: `${(month.expenseCents / maxAmount) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.monthValues}>
            <Text tone="positive" variant="caption">
              {formatCurrencyCents(month.incomeCents)}
            </Text>
            <Text tone="negative" variant="caption">
              {formatCurrencyCents(-month.expenseCents)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function CategoryRow({
  category,
  selected,
  onPress,
}: {
  category: FinancialReportCategory;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const signedAmount = category.kind === 'expense' ? -category.amountCents : category.amountCents;
  return (
    <Pressable
      accessibilityHint={selected ? ptBR.reports.closeDetails : ptBR.reports.openDetails}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.categoryRow,
        { borderTopColor: colors.border },
        selected && { backgroundColor: colors.primarySubtle },
      ]}
    >
      <View style={styles.categoryName}>
        <Text numberOfLines={1} variant="label">
          {category.name}
        </Text>
        <Text tone="secondary" variant="caption">
          {category.kind === 'expense'
            ? ptBR.reports.categoryKindExpense
            : ptBR.reports.categoryKindIncome}
        </Text>
      </View>
      <AmountText
        amountCents={signedAmount}
        tone={category.kind === 'expense' ? 'negative' : 'positive'}
        variant="label"
      />
    </Pressable>
  );
}

function TransactionRow({ item }: { item: FinancialReportTransaction }) {
  const { colors } = useTheme();
  const { transaction } = item;
  const amount = getSignedAmount(transaction);
  const secondary = [
    transaction.kind === 'transfer'
      ? `${item.accountName} → ${item.transferAccountName ?? ''}`
      : (item.categoryName ?? ptBR.reports.uncategorized),
    formatDate(transaction.date),
    transaction.isPaid ? undefined : ptBR.reports.pending,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View
      accessible
      accessibilityLabel={`${transaction.description}, ${formatCurrencyCents(amount)}, ${secondary}`}
      style={[styles.transactionRow, { borderTopColor: colors.border }]}
    >
      <View style={styles.transactionDetails}>
        <Text numberOfLines={1} variant="label">
          {transaction.description}
        </Text>
        <Text numberOfLines={2} tone="secondary" variant="caption">
          {secondary}
        </Text>
      </View>
      <AmountText
        amountCents={amount}
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
    paddingBottom: spacing[4],
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  titleGroup: {
    flex: 1,
    gap: spacing[1],
  },
  periodSelector: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  chip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    justifyContent: 'center',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[3],
  },
  customPeriodRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing[3],
  },
  customPeriodButton: {
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[2],
  },
  filterGroup: {
    gap: spacing[1],
  },
  filterChoices: {
    gap: spacing[2],
  },
  errorCard: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  loading: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
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
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  monthList: {
    gap: spacing[3],
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  monthLabel: {
    width: spacing[12],
  },
  monthBars: {
    flex: 1,
    gap: spacing[1],
  },
  barTrack: {
    borderRadius: radius.pill,
    height: spacing[2],
    overflow: 'hidden',
  },
  bar: {
    borderRadius: radius.pill,
    height: '100%',
    minWidth: spacing[1],
  },
  monthValues: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  categoryRow: {
    alignItems: 'center',
    borderTopWidth: layout.borderWidth,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: layout.touchTarget,
    paddingVertical: spacing[2],
  },
  categoryName: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  closeDetailsButton: {
    maxWidth: '55%',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[1],
  },
  emptyDetails: {
    paddingHorizontal: spacing[4],
  },
  transactionRow: {
    alignItems: 'center',
    borderTopWidth: layout.borderWidth,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[3],
  },
  transactionDetails: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  exportSection: {
    gap: spacing[2],
  },
  exportButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  exportButton: {
    flex: 1,
  },
});
