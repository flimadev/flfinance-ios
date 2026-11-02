import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import type { Account } from '@/src/db/schema';
import type { InvoiceWithTotal } from '@/src/services/InvoiceService';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { AmountText, Button, Card, EmptyState, Screen, Text } from '@/src/ui';
import { getTransactionServices } from '@/src/features/transactions/transactionData';

type CardInvoiceMap = Record<string, InvoiceWithTotal[]>;

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthNumber - 1, 1),
  );
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day),
  );
}

function parseDay(value: string): number | null {
  if (!/^\d{1,2}$/.test(value)) {
    return null;
  }
  const day = Number(value);
  return day >= 1 && day <= 31 ? day : null;
}

export default function CardsScreen() {
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoiceMap, setInvoiceMap] = useState<CardInvoiceMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [editingCard, setEditingCard] = useState<Account | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [cardName, setCardName] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { accountService, invoiceService } = await getTransactionServices();
      const listedAccounts = await accountService.list();
      const activeAccounts = listedAccounts.filter(
        (account) => account.deletedAt === null && account.archivedAt === null,
      );
      const creditCards = activeAccounts.filter((account) => account.type === 'credit_card');
      const invoiceEntries = await Promise.all(
        creditCards.map(
          async (card) => [card.id, await invoiceService.listByAccount(card.id)] as const,
        ),
      );
      setAccounts(activeAccounts);
      setInvoiceMap(Object.fromEntries(invoiceEntries));
      setPaymentAccountId((current) =>
        activeAccounts.some((account) => account.id === current && account.type !== 'credit_card')
          ? current
          : (activeAccounts.find((account) => account.type !== 'credit_card')?.id ?? ''),
      );
      setError(null);
    } catch (loadError) {
      console.error('Não foi possível carregar cartões e faturas.', loadError);
      setError(loadError instanceof Error ? loadError.message : ptBR.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const creditCards = accounts.filter((account) => account.type === 'credit_card');
  const paymentAccounts = accounts.filter((account) => account.type !== 'credit_card');

  function openCreateCard() {
    setEditingCard(null);
    setCardName('');
    setClosingDay('');
    setDueDay('');
    setOperationError(null);
    setEditorVisible(true);
  }

  function openEditCard(account: Account) {
    setEditingCard(account);
    setCardName(account.name);
    setClosingDay(String(account.closingDay ?? ''));
    setDueDay(String(account.dueDay ?? ''));
    setOperationError(null);
    setEditorVisible(true);
  }

  async function saveCard() {
    const closing = parseDay(closingDay);
    const due = parseDay(dueDay);
    if (!cardName.trim() || closing === null || due === null) {
      setOperationError(ptBR.cards.validation);
      return;
    }

    setSaving(true);
    setOperationError(null);
    try {
      const { accountService } = await getTransactionServices();
      if (editingCard) {
        await accountService.update(editingCard.id, {
          name: cardName,
          closingDay: closing,
          dueDay: due,
        });
      } else {
        await accountService.create({
          name: cardName,
          type: 'credit_card',
          initialBalanceCents: 0,
          color: '#147A58',
          icon: 'creditcard.fill',
          closingDay: closing,
          dueDay: due,
        });
      }
      setEditorVisible(false);
      await reload();
    } catch (saveError) {
      console.error('Não foi possível salvar o cartão.', saveError);
      setOperationError(saveError instanceof Error ? saveError.message : ptBR.errors.unexpected);
    } finally {
      setSaving(false);
    }
  }

  async function payInvoice(invoice: InvoiceWithTotal) {
    if (!paymentAccountId) {
      setOperationError(ptBR.cards.noPaymentAccounts);
      return;
    }
    setOperationError(null);
    try {
      const { invoiceService } = await getTransactionServices();
      await invoiceService.pay(invoice.id, paymentAccountId);
      await reload();
    } catch (paymentError) {
      console.error('Não foi possível pagar a fatura.', paymentError);
      setOperationError(
        paymentError instanceof Error ? paymentError.message : ptBR.errors.unexpected,
      );
    }
  }

  return (
    <Screen contentContainerStyle={styles.content} scrollable testID="cards-screen">
      <View style={styles.header}>
        <Text variant="title">{ptBR.cards.title}</Text>
        <Button
          accessibilityLabel={ptBR.cards.addCard}
          haptic={false}
          onPress={openCreateCard}
          style={styles.addButton}
        >
          +
        </Button>
      </View>
      <Text tone="secondary">{ptBR.cards.description}</Text>

      {operationError ? (
        <Text accessibilityRole="alert" tone="negative">
          {operationError}
        </Text>
      ) : null}
      {error ? (
        <View style={styles.error}>
          <Text accessibilityRole="alert" tone="negative">
            {error}
          </Text>
          <Button haptic={false} onPress={() => void reload()}>
            {ptBR.cards.retry}
          </Button>
        </View>
      ) : null}
      {loading && accounts.length === 0 ? (
        <ActivityIndicator
          accessibilityLabel={ptBR.cards.loading}
          color={colors.primary}
          size="large"
          style={styles.loader}
        />
      ) : creditCards.length === 0 ? (
        <EmptyState
          actionLabel={ptBR.cards.addCard}
          description={ptBR.cards.cardsEmptyDescription}
          onAction={openCreateCard}
          title={ptBR.cards.cardsEmptyTitle}
        />
      ) : (
        <>
          {paymentAccounts.length ? (
            <Card style={styles.paymentCard}>
              <Text variant="label">{ptBR.cards.paymentAccount}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.accountChoices}>
                  {paymentAccounts.map((account) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: account.id === paymentAccountId }}
                      key={account.id}
                      onPress={() => setPaymentAccountId(account.id)}
                      style={[
                        styles.accountChoice,
                        {
                          backgroundColor:
                            account.id === paymentAccountId ? colors.primarySubtle : colors.surface,
                          borderColor:
                            account.id === paymentAccountId ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text variant="label">{account.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Card>
          ) : (
            <Text tone="secondary">{ptBR.cards.noPaymentAccounts}</Text>
          )}

          <Text variant="heading">{ptBR.cards.invoices}</Text>
          {creditCards.map((card) => {
            const invoices = [...(invoiceMap[card.id] ?? [])].reverse();
            return (
              <View key={card.id} style={styles.cardSection}>
                <Card style={styles.cardHeader}>
                  <View style={styles.cardTitle}>
                    <View style={[styles.cardIcon, { backgroundColor: colors.primarySubtle }]}>
                      <SymbolView
                        name={{
                          ios: 'creditcard.fill',
                          android: 'credit_card',
                          web: 'credit_card',
                        }}
                        size={20}
                        tintColor={colors.primary}
                      />
                    </View>
                    <View style={styles.cardNameContainer}>
                      <Text numberOfLines={1} variant="heading">
                        {card.name}
                      </Text>
                      <Text tone="secondary" variant="caption">
                        {ptBR.cards.closingDay}: {card.closingDay} · {ptBR.cards.dueDay}:{' '}
                        {card.dueDay}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityLabel={`${ptBR.cards.editCard} ${card.name}`}
                    accessibilityRole="button"
                    onPress={() => openEditCard(card)}
                    style={styles.editButton}
                  >
                    <SymbolView
                      name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                      size={18}
                      tintColor={colors.primary}
                    />
                  </Pressable>
                </Card>
                {invoices.length ? (
                  invoices.map((invoice) => (
                    <InvoiceCard
                      invoice={invoice}
                      key={invoice.id}
                      onPay={() => void payInvoice(invoice)}
                    />
                  ))
                ) : (
                  <Text style={styles.noInvoices} tone="secondary">
                    {ptBR.cards.noInvoices}
                  </Text>
                )}
              </View>
            );
          })}
        </>
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => setEditorVisible(false)}
        presentationStyle="pageSheet"
        visible={editorVisible}
      >
        <View style={[styles.editor, { backgroundColor: colors.background }]}>
          <View style={styles.editorHeader}>
            <Text variant="heading">{editingCard ? ptBR.cards.editCard : ptBR.cards.addCard}</Text>
            <Pressable
              accessibilityLabel={ptBR.cards.closeEditor}
              accessibilityRole="button"
              onPress={() => setEditorVisible(false)}
              style={styles.editButton}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={20}
                tintColor={colors.text}
              />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editorContent}>
            <EditorField
              accessibilityLabel={ptBR.cards.cardName}
              label={ptBR.cards.cardName}
              onChangeText={setCardName}
              placeholder={ptBR.cards.cardNamePlaceholder}
              value={cardName}
            />
            <EditorField
              accessibilityLabel={ptBR.cards.closingDay}
              keyboardType="number-pad"
              label={ptBR.cards.closingDay}
              maxLength={2}
              onChangeText={setClosingDay}
              value={closingDay}
            />
            <EditorField
              accessibilityLabel={ptBR.cards.dueDay}
              keyboardType="number-pad"
              label={ptBR.cards.dueDay}
              maxLength={2}
              onChangeText={setDueDay}
              value={dueDay}
            />
            {operationError ? (
              <Text accessibilityRole="alert" tone="negative">
                {operationError}
              </Text>
            ) : null}
            <View style={styles.editorActions}>
              <Button haptic={false} onPress={() => setEditorVisible(false)} variant="secondary">
                {ptBR.cards.cancel}
              </Button>
              <Button loading={saving} onPress={() => void saveCard()}>
                {ptBR.cards.saveCard}
              </Button>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function InvoiceCard({ invoice, onPay }: { invoice: InvoiceWithTotal; onPay: () => void }) {
  const paid = invoice.status === 'paid';

  return (
    <Card style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceInfo}>
          <Text variant="label">{ptBR.cards.invoice(formatMonth(invoice.billingMonth))}</Text>
          <Text tone="secondary" variant="caption">
            {ptBR.cards.dueDate(formatDate(invoice.dueDate))}
          </Text>
        </View>
        <Text tone={paid ? 'positive' : 'negative'} variant="caption">
          {paid ? ptBR.cards.paid : ptBR.cards.open}
        </Text>
      </View>
      <AmountText amountCents={invoice.totalCents} variant="title" />
      {!paid && invoice.totalCents > 0 ? (
        <Button accessibilityHint={ptBR.cards.paymentAccount} onPress={onPay}>
          {ptBR.cards.payInvoice}
        </Button>
      ) : null}
      {paid && invoice.paymentAccountId ? (
        <Text tone="secondary" variant="caption">
          {ptBR.cards.paymentSuccess}
        </Text>
      ) : null}
      {invoice.totalCents === 0 && !paid ? (
        <Text tone="secondary" variant="caption">
          {ptBR.cards.noInvoices}
        </Text>
      ) : null}
    </Card>
  );
}

function EditorField({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        allowFontScaling
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
        {...props}
      />
    </View>
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
  addButton: {
    minWidth: layout.touchTarget,
    paddingHorizontal: spacing[3],
  },
  loader: {
    marginTop: spacing[8],
  },
  error: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  paymentCard: {
    gap: spacing[3],
    padding: spacing[4],
  },
  accountChoices: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  accountChoice: {
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    justifyContent: 'center',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[3],
  },
  cardSection: {
    gap: spacing[2],
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  cardTitle: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing[3],
    minWidth: 0,
  },
  cardIcon: {
    alignItems: 'center',
    borderRadius: radius.medium,
    height: spacing[10],
    justifyContent: 'center',
    width: spacing[10],
  },
  cardNameContainer: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  editButton: {
    alignItems: 'center',
    height: layout.touchTarget,
    justifyContent: 'center',
    width: layout.touchTarget,
  },
  invoiceCard: {
    gap: spacing[3],
    marginLeft: spacing[4],
    padding: spacing[4],
  },
  invoiceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  invoiceInfo: {
    gap: spacing[1],
  },
  noInvoices: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  editor: {
    flex: 1,
    paddingTop: spacing[4],
  },
  editorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
  },
  editorContent: {
    gap: spacing[4],
    padding: spacing[4],
  },
  field: {
    gap: spacing[2],
  },
  input: {
    borderRadius: radius.medium,
    borderWidth: layout.borderWidth,
    fontSize: 16,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[3],
  },
  editorActions: {
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'flex-end',
  },
});
