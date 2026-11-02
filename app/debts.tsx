import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { DebtItem } from '@/src/features/debts/useDebts';
import { useDebts } from '@/src/features/debts/useDebts';
import { getLocalDateString } from '@/src/domain/transactions';
import { summarizeDebtBalances } from '@/src/domain/debts';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { AmountText, Button, Card, EmptyState, Screen, Text } from '@/src/ui';
import { useModalAnimationType } from '@/src/ui/useModalAnimationType';

function formatDueDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day),
  );
}

function sumRecurringMonthly(debts: { amountCents: number }[]): number {
  return debts.reduce((total, debt) => {
    const next = total + debt.amountCents;
    if (!Number.isSafeInteger(next)) {
      throw new RangeError('A previsão recorrente excede o limite seguro de centavos.');
    }
    return next;
  }, 0);
}

function formatExpenseCents(amountCents: number): number {
  return amountCents === 0 ? 0 : -amountCents;
}

export default function DebtsScreen() {
  const { colors } = useTheme();
  const modalAnimationType = useModalAnimationType();
  const {
    debts,
    recurringDebts,
    paymentAccounts,
    loading,
    error,
    operationError,
    reload,
    markTransactionPaid,
    payInvoice,
  } = useDebts();
  const [invoiceToPay, setInvoiceToPay] = useState<Extract<DebtItem, { kind: 'invoice' }> | null>(
    null,
  );
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const today = getLocalDateString(new Date());
  const summary = summarizeDebtBalances(debts, today);
  const monthlyEstimateCents = sumRecurringMonthly(recurringDebts);

  function openInvoicePayment(invoice: Extract<DebtItem, { kind: 'invoice' }>) {
    setInvoiceToPay(invoice);
    setPaymentAccountId(paymentAccounts[0]?.id ?? '');
  }

  async function confirmInvoicePayment() {
    if (!invoiceToPay || !paymentAccountId) {
      return;
    }

    setPayingInvoice(true);
    const paid = await payInvoice(invoiceToPay.invoiceId, paymentAccountId);
    setPayingInvoice(false);
    if (paid) {
      setInvoiceToPay(null);
      setSuccessMessage(ptBR.debts.paymentSuccess);
    }
  }

  async function markAsPaid(transactionId: string) {
    const paid = await markTransactionPaid(transactionId);
    if (paid) {
      setSuccessMessage(ptBR.debts.paymentSuccess);
    }
  }

  function renderDebtItem({ item }: { item: DebtItem }) {
    const isOverdue = item.dueDate < today;

    return (
      <Card style={styles.debtCard}>
        <View style={styles.debtDetails}>
          <View style={styles.debtDescription}>
            <Text numberOfLines={2} variant="heading">
              {item.description}
            </Text>
            <Text numberOfLines={1} tone="secondary" variant="caption">
              {item.accountName}
            </Text>
            {item.kind === 'transaction' &&
            item.installmentNumber !== null &&
            item.installmentTotal !== null ? (
              <Text tone="secondary" variant="caption">
                {ptBR.debts.installment(item.installmentNumber, item.installmentTotal)}
              </Text>
            ) : null}
          </View>
          <View style={styles.debtAmount}>
            <AmountText amountCents={-item.amountCents} tone="negative" variant="label" />
            <Text tone={isOverdue ? 'negative' : 'secondary'} variant="caption">
              {isOverdue
                ? ptBR.debts.overdueDate(formatDueDate(item.dueDate))
                : ptBR.debts.dueDate(formatDueDate(item.dueDate))}
            </Text>
          </View>
        </View>
        {item.kind === 'invoice' ? (
          <Button haptic={false} onPress={() => openInvoicePayment(item)} variant="secondary">
            {ptBR.debts.payInvoice}
          </Button>
        ) : (
          <Button haptic={false} onPress={() => void markAsPaid(item.id)} variant="secondary">
            {ptBR.debts.markPaid}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Screen style={styles.screen} testID="debts-screen">
      <FlashList
        contentContainerStyle={styles.listContent}
        data={debts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text accessibilityRole="progressbar" accessibilityLabel={ptBR.debts.loading}>
                {ptBR.debts.loading}
              </Text>
            </View>
          ) : error ? null : (
            <EmptyState
              description={ptBR.debts.noDebtsDescription}
              icon={
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={24}
                  tintColor={colors.primary}
                />
              }
              title={ptBR.debts.noDebtsTitle}
            />
          )
        }
        ListFooterComponent={
          <View style={styles.recurringSection}>
            <View style={styles.sectionHeading}>
              <Text variant="heading">{ptBR.debts.recurring}</Text>
              {recurringDebts.length > 0 ? (
                <View style={styles.recurringEstimate}>
                  <Text tone="secondary" variant="caption">
                    {ptBR.debts.monthlyEstimate}
                  </Text>
                  <AmountText amountCents={monthlyEstimateCents} variant="label" />
                </View>
              ) : null}
            </View>
            {error || (loading && recurringDebts.length === 0) ? null : recurringDebts.length ===
              0 ? (
              <EmptyState
                description={ptBR.debts.noRecurringDescription}
                title={ptBR.debts.noRecurringTitle}
              />
            ) : (
              recurringDebts.map((debt) => (
                <Card key={debt.id} style={styles.recurringCard}>
                  <View style={styles.debtDetails}>
                    <View style={styles.debtDescription}>
                      <Text numberOfLines={2} variant="heading">
                        {debt.description}
                      </Text>
                      <Text numberOfLines={1} tone="secondary" variant="caption">
                        {debt.accountName} · {ptBR.debts.recurringCadence}
                      </Text>
                    </View>
                    <View style={styles.debtAmount}>
                      <AmountText amountCents={-debt.amountCents} tone="negative" variant="label" />
                      <Text tone="secondary" variant="caption">
                        {ptBR.debts.dueDate(formatDueDate(debt.nextDate))}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.headerActions}>
              <Link asChild href="/">
                <Button haptic={false} variant="ghost">
                  {ptBR.debts.backToHome}
                </Button>
              </Link>
              <Link asChild href="/(tabs)/transactions">
                <Button
                  accessibilityLabel={ptBR.transactions.add}
                  haptic={false}
                  style={styles.newButton}
                  variant="secondary"
                >
                  {ptBR.transactions.addShort}
                </Button>
              </Link>
            </View>
            <View style={styles.titleContainer}>
              <Text variant="title">{ptBR.debts.title}</Text>
              <Text tone="secondary">{ptBR.debts.description}</Text>
            </View>

            {error ? (
              <Card style={styles.errorCard}>
                <Text accessibilityRole="alert" tone="negative">
                  {error}
                </Text>
                <Button haptic={false} onPress={() => void reload()}>
                  {ptBR.dashboard.retry}
                </Button>
              </Card>
            ) : null}
            {operationError ? (
              <Text accessibilityRole="alert" tone="negative">
                {`${ptBR.debts.paymentError} ${operationError}`}
              </Text>
            ) : null}
            {successMessage ? (
              <Text accessibilityLiveRegion="polite" tone="positive">
                {successMessage}
              </Text>
            ) : null}

            <Card style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text tone="secondary" variant="label">
                  {ptBR.debts.outstanding}
                </Text>
                <AmountText
                  amountCents={formatExpenseCents(summary.outstandingCents)}
                  tone="negative"
                  variant="title"
                />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text tone="secondary" variant="label">
                  {ptBR.debts.overdue}
                </Text>
                <AmountText
                  amountCents={formatExpenseCents(summary.overdueCents)}
                  tone="negative"
                  variant="heading"
                />
              </View>
            </Card>
            <View style={styles.sectionHeading}>
              <Text variant="heading">{ptBR.debts.scheduled}</Text>
              {debts.length > 0 ? (
                <Text tone="secondary" variant="caption">
                  {ptBR.debts.upcoming}
                </Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={renderDebtItem}
        showsVerticalScrollIndicator={false}
        testID="debts-list"
      />

      <Modal
        animationType={modalAnimationType}
        onRequestClose={() => setInvoiceToPay(null)}
        transparent
        visible={invoiceToPay !== null}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.paymentModal, { backgroundColor: colors.surface }]}>
              <Text variant="heading">{ptBR.debts.paymentTitle}</Text>
              {invoiceToPay ? (
                <Text tone="secondary">
                  {ptBR.debts.paymentDescription(invoiceToPay.description)}
                </Text>
              ) : null}
              <AmountText
                amountCents={invoiceToPay ? -invoiceToPay.amountCents : 0}
                tone="negative"
                variant="title"
              />
              <Text variant="label">{ptBR.debts.chooseAccount}</Text>
              {paymentAccounts.length === 0 ? (
                <Text accessibilityRole="alert" tone="negative">
                  {ptBR.cards.noPaymentAccounts}
                </Text>
              ) : (
                paymentAccounts.map((account) => {
                  const selected = paymentAccountId === account.id;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={account.id}
                      onPress={() => setPaymentAccountId(account.id)}
                      style={[
                        styles.accountOption,
                        {
                          backgroundColor: selected ? colors.primarySubtle : colors.surface,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text>{account.name}</Text>
                      {selected ? (
                        <SymbolView
                          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                          size={18}
                          tintColor={colors.primary}
                        />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
              {operationError ? (
                <Text accessibilityRole="alert" tone="negative">
                  {`${ptBR.debts.paymentError} ${operationError}`}
                </Text>
              ) : null}
              <Button
                disabled={!paymentAccountId || paymentAccounts.length === 0}
                loading={payingInvoice}
                onPress={() => void confirmInvoicePayment()}
              >
                {ptBR.debts.confirmPayment}
              </Button>
              <Button haptic={false} onPress={() => setInvoiceToPay(null)} variant="ghost">
                {ptBR.debts.cancel}
              </Button>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 0,
  },
  listContent: {
    gap: spacing[3],
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  headerContent: {
    gap: spacing[4],
    marginBottom: spacing[3],
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleContainer: {
    gap: spacing[1],
  },
  newButton: {
    minWidth: layout.touchTarget,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  summaryItem: {
    flex: 1,
    gap: spacing[2],
  },
  divider: {
    height: spacing[10],
    width: layout.borderWidth,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  debtCard: {
    gap: spacing[3],
  },
  debtDetails: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[3],
  },
  debtDescription: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  debtAmount: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  recurringSection: {
    gap: spacing[3],
    marginTop: spacing[6],
  },
  recurringEstimate: {
    alignItems: 'flex-end',
  },
  recurringCard: {
    marginBottom: spacing[2],
  },
  loading: {
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[6],
  },
  errorCard: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[4],
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  paymentModal: {
    borderRadius: radius.xlarge,
    gap: spacing[4],
    padding: spacing[5],
  },
  accountOption: {
    alignItems: 'center',
    borderRadius: radius.medium,
    borderWidth: layout.borderWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[4],
  },
});
