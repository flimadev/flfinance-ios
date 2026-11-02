import { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Account, Attachment, Category, Tag, Transaction } from '@/src/db/schema';
import type { CreateTransactionInput } from '@/src/domain/financeSchemas';
import type { AttachmentMimeType } from '@/src/services/AttachmentService';
import { getLocalDateString, parseCurrencyDigitsToCents } from '@/src/domain/transactions';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, typography, useTheme } from '@/src/theme';
import { AmountText, Button, Text } from '@/src/ui';
import { useModalAnimationType } from '@/src/ui/useModalAnimationType';
import type { TransactionFormInput } from './transactionFormTypes';

type TransactionFormSheetProps = {
  transaction?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTagIds: string[];
  attachments: Attachment[];
  onClose: () => void;
  onSave: (
    input: TransactionFormInput,
    retryTransactionId?: string,
  ) => Promise<Transaction | null | void>;
  onSaveExtras: (
    transactionId: string,
    tagIds: string[],
    newAttachments: PickedAttachment[],
    removedAttachmentIds: string[],
  ) => Promise<void>;
};

type TransactionKind = CreateTransactionInput['kind'];
type PaymentMethod = Exclude<NonNullable<CreateTransactionInput['paymentMethod']>, 'transfer'>;
type PickedAttachment = {
  id: string;
  uri: string;
  mimeType: AttachmentMimeType;
  fileName: string | null;
  sizeBytes: number;
};

const kinds: { value: TransactionKind; label: string }[] = [
  { value: 'expense', label: ptBR.transactions.expense },
  { value: 'income', label: ptBR.transactions.income },
  { value: 'transfer', label: ptBR.transactions.transfer },
];

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: ptBR.transactions.methods.pix },
  { value: 'debit', label: ptBR.transactions.methods.debit },
  { value: 'credit', label: ptBR.transactions.methods.credit },
  { value: 'cash', label: ptBR.transactions.methods.cash },
  { value: 'boleto', label: ptBR.transactions.methods.boleto },
];

export function TransactionFormSheet({
  transaction,
  accounts,
  categories,
  tags,
  transactionTagIds,
  attachments,
  onClose,
  onSave,
  onSaveExtras,
}: TransactionFormSheetProps) {
  const { colors } = useTheme();
  const modalAnimationType = useModalAnimationType();
  const availableAccounts = useMemo(
    () => accounts.filter((account) => account.archivedAt === null && account.deletedAt === null),
    [accounts],
  );
  const [kind, setKind] = useState<TransactionKind>(() => transaction?.kind ?? 'expense');
  const [amountDigits, setAmountDigits] = useState(() => String(transaction?.amountCents ?? 0));
  const [description, setDescription] = useState(() => transaction?.description ?? '');
  const [date, setDate] = useState(() => transaction?.date ?? getLocalDateString(new Date()));
  const [accountId, setAccountId] = useState(
    () =>
      transaction?.accountId ??
      availableAccounts.find((account) => account.type !== 'credit_card')?.id ??
      availableAccounts[0]?.id ??
      '',
  );
  const [transferAccountId, setTransferAccountId] = useState(
    () => transaction?.transferAccountId ?? '',
  );
  const [categoryId, setCategoryId] = useState(() => transaction?.categoryId ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    transaction?.paymentMethod && transaction.paymentMethod !== 'transfer'
      ? transaction.paymentMethod
      : 'pix',
  );
  const [isPaid, setIsPaid] = useState(() => transaction?.isPaid ?? true);
  const [installmentCount, setInstallmentCount] = useState('1');
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState(transactionTagIds);
  const [newAttachments, setNewAttachments] = useState<PickedAttachment[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [persistedTransaction, setPersistedTransaction] = useState<Transaction | null>(null);

  const amountCents = parseCurrencyDigitsToCents(amountDigits) ?? 0;
  const compatibleCategories = categories.filter(
    (category) =>
      category.kind === kind && category.archivedAt === null && category.deletedAt === null,
  );
  const destinationAccounts = availableAccounts.filter((account) => account.id !== accountId);
  const selectedAccount = availableAccounts.find((account) => account.id === accountId);
  const isCreditCard = selectedAccount?.type === 'credit_card';
  const parsedInstallmentCount = /^\d{1,3}$/.test(installmentCount)
    ? Number(installmentCount)
    : Number.NaN;

  function appendDigit(digit: string) {
    setAmountDigits((current) => {
      const next = current === '0' ? digit : `${current}${digit}`;
      return parseCurrencyDigitsToCents(next) === null ? current : next;
    });
  }

  function eraseDigit() {
    setAmountDigits((current) => (current.length <= 1 ? '0' : current.slice(0, -1)));
  }

  async function submit() {
    if (saving) {
      return;
    }
    if (amountCents <= 0 || !description.trim() || !accountId) {
      setError(ptBR.transactions.validation);
      return;
    }
    if (kind === 'transfer' && (!transferAccountId || transferAccountId === accountId)) {
      setError(ptBR.errors.invalidTransfer);
      return;
    }
    if (isCreditCard && kind !== 'expense') {
      setError(ptBR.transactions.creditAccountWarning);
      return;
    }
    if (
      isCreditCard &&
      (!Number.isInteger(parsedInstallmentCount) ||
        parsedInstallmentCount < 1 ||
        parsedInstallmentCount > 120)
    ) {
      setError(ptBR.transactions.installmentsValidation);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const input: TransactionFormInput = {
        accountId,
        categoryId: kind === 'transfer' || !categoryId ? null : categoryId,
        kind,
        amountCents,
        date,
        description,
        paymentMethod: kind === 'transfer' ? 'transfer' : isCreditCard ? 'credit' : paymentMethod,
        transferAccountId: kind === 'transfer' ? transferAccountId : null,
        isPaid: isCreditCard ? false : isPaid,
        ...(!transaction && isCreditCard ? { installmentCount: parsedInstallmentCount } : {}),
        ...(!transaction && !isCreditCard && kind !== 'transfer' && recurring
          ? { recurring: true }
          : {}),
      };
      const saved = persistedTransaction
        ? await onSave(input, persistedTransaction.id)
        : await onSave(input);
      if (saved?.id) {
        setPersistedTransaction(saved);
        await onSaveExtras(
          saved.id,
          kind === 'transfer' ? [] : selectedTagIds,
          newAttachments,
          removedAttachmentIds,
        );
      }
      onClose();
    } catch (saveError) {
      console.error('Não foi possível salvar o lançamento.', saveError);
      setError(saveError instanceof Error ? saveError.message : ptBR.errors.unexpected);
    } finally {
      setSaving(false);
    }
  }

  async function pickImage(source: 'camera' | 'library') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(ptBR.transactions.cameraPermission);
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(ptBR.transactions.photosPermission);
          return;
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.75 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.75,
            });
      if (result.canceled) return;
      const asset = result.assets[0];
      const sizeBytes = asset
        ? (asset.fileSize ?? new File(asset.uri).info().size ?? undefined)
        : undefined;
      if (!asset || sizeBytes === undefined || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) {
        setError(ptBR.transactions.attachmentTooLarge);
        return;
      }
      const extension = asset.fileName?.split('.').pop()?.toLowerCase();
      const mimeType =
        asset.mimeType ??
        (extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : extension === 'heic'
              ? 'image/heic'
              : 'image/jpeg');
      if (
        mimeType !== 'image/jpeg' &&
        mimeType !== 'image/png' &&
        mimeType !== 'image/webp' &&
        mimeType !== 'image/heic'
      ) {
        setError(ptBR.transactions.attachmentUnsupported);
        return;
      }
      setNewAttachments((current) => [
        ...current,
        {
          id: Crypto.randomUUID(),
          uri: asset.uri,
          mimeType,
          fileName: asset.fileName ?? null,
          sizeBytes,
        },
      ]);
      setError(null);
    } catch (pickerError) {
      console.error('Não foi possível adicionar a imagem ao lançamento.', pickerError);
      setError(ptBR.transactions.attachmentError);
    }
  }

  const canEditExtras = !recurring && (!isCreditCard || Boolean(transaction));
  const visibleAttachments = [
    ...attachments.filter((attachment) => !removedAttachmentIds.includes(attachment.id)),
    ...newAttachments.map((attachment, index) => ({
      ...attachment,
      id: `new-${index}`,
    })),
  ];

  return (
    <Modal
      animationType={modalAnimationType}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Text variant="heading">
              {transaction ? ptBR.transactions.edit : ptBR.transactions.create}
            </Text>
            <Pressable
              accessibilityLabel={ptBR.transactions.cancel}
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSubtle }]}
            >
              <Text variant="heading" tone="secondary">
                ×
              </Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.kindRow}>
              {kinds.map((item) => (
                <ChoiceButton
                  key={item.value}
                  label={item.label}
                  onPress={() => {
                    setKind(item.value);
                    setCategoryId('');
                    setRecurring(false);
                    if (item.value !== 'transfer') {
                      setTransferAccountId('');
                    }
                    if (item.value !== 'expense' && isCreditCard) {
                      setAccountId(
                        availableAccounts.find((account) => account.type !== 'credit_card')?.id ??
                          '',
                      );
                    }
                  }}
                  selected={kind === item.value}
                />
              ))}
            </View>

            <View style={[styles.amountCard, { backgroundColor: colors.surface }]}>
              <Text tone="secondary">{ptBR.transactions.amount}</Text>
              <AmountText amountCents={amountCents} variant="display" />
              <Text accessibilityHint={ptBR.transactions.amountHint} tone="muted" variant="caption">
                {ptBR.transactions.amountHint}
              </Text>
            </View>
            <View style={styles.keypad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', '00'].map((key) => (
                <Pressable
                  key={key}
                  accessibilityLabel={
                    key === 'erase'
                      ? ptBR.transactions.keypad.erase
                      : ptBR.transactions.keypad.digit(key)
                  }
                  accessibilityRole="button"
                  onPress={() => (key === 'erase' ? eraseDigit() : appendDigit(key))}
                  style={({ pressed }) => [
                    styles.key,
                    { backgroundColor: colors.surfaceSubtle, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text variant="heading">{key === 'erase' ? '⌫' : key}</Text>
                </Pressable>
              ))}
            </View>

            <FormField
              label={ptBR.transactions.description}
              value={description}
              onChangeText={setDescription}
              placeholder={ptBR.transactions.descriptionPlaceholder}
              accessibilityLabel={ptBR.transactions.description}
              returnKeyType="done"
            />
            <FormField
              label={ptBR.transactions.date}
              value={date}
              onChangeText={setDate}
              placeholder={ptBR.transactions.datePlaceholder}
              accessibilityLabel={ptBR.transactions.date}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            <ChoiceGroup
              label={ptBR.transactions.account}
              options={availableAccounts.map((account) => ({
                id: account.id,
                label: account.name,
              }))}
              selectedId={accountId}
              onSelect={(value) => {
                const nextAccount = availableAccounts.find((account) => account.id === value);
                setAccountId(value);
                if (nextAccount?.type === 'credit_card') {
                  setKind('expense');
                  setPaymentMethod('credit');
                  setIsPaid(false);
                  setRecurring(false);
                } else if (paymentMethod === 'credit') {
                  setPaymentMethod('pix');
                }
              }}
            />

            {kind === 'transfer' ? (
              <ChoiceGroup
                label={ptBR.transactions.destinationAccount}
                options={destinationAccounts.map((account) => ({
                  id: account.id,
                  label: account.name,
                }))}
                selectedId={transferAccountId}
                onSelect={setTransferAccountId}
              />
            ) : (
              <>
                <ChoiceGroup
                  label={ptBR.transactions.category}
                  options={[
                    { id: '', label: ptBR.transactions.noCategory },
                    ...compatibleCategories.map((category) => ({
                      id: category.id,
                      label: category.name,
                    })),
                  ]}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                />
                {!isCreditCard ? (
                  <ChoiceGroup
                    label={ptBR.transactions.paymentMethod}
                    options={paymentMethods
                      .filter((method) => method.value !== 'credit')
                      .map((method) => ({
                        id: method.value,
                        label: method.label,
                      }))}
                    selectedId={paymentMethod}
                    onSelect={(value) => {
                      if (isPaymentMethod(value)) {
                        setPaymentMethod(value);
                      }
                    }}
                  />
                ) : null}
                {!transaction && isCreditCard ? (
                  <FormField
                    accessibilityLabel={ptBR.transactions.installments}
                    keyboardType="number-pad"
                    label={ptBR.transactions.installments}
                    maxLength={3}
                    onChangeText={setInstallmentCount}
                    value={installmentCount}
                  />
                ) : null}
                {!transaction && !isCreditCard ? (
                  <View style={styles.group}>
                    <ChoiceGroup
                      label={ptBR.transactions.monthlyRecurrence}
                      options={[
                        { id: 'no', label: ptBR.transactions.noRecurrence },
                        { id: 'yes', label: ptBR.transactions.monthlyRecurrence },
                      ]}
                      selectedId={recurring ? 'yes' : 'no'}
                      onSelect={(value) => setRecurring(value === 'yes')}
                    />
                    {recurring ? (
                      <Text tone="secondary" variant="caption">
                        {ptBR.transactions.repeatHint}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}

            {!isCreditCard ? (
              <ChoiceGroup
                label={ptBR.transactions.paid}
                options={[
                  { id: 'paid', label: ptBR.transactions.paid },
                  { id: 'pending', label: ptBR.transactions.pending },
                ]}
                selectedId={isPaid ? 'paid' : 'pending'}
                onSelect={(value) => setIsPaid(value === 'paid')}
              />
            ) : null}

            {canEditExtras && kind !== 'transfer' ? (
              <>
                <View style={styles.group}>
                  <Text variant="label">{ptBR.transactions.tags}</Text>
                  {tags.length > 0 ? (
                    <View style={styles.choiceRow}>
                      {tags.map((tag) => {
                        const selected = selectedTagIds.includes(tag.id);
                        return (
                          <ChoiceButton
                            key={tag.id}
                            label={tag.name}
                            onPress={() =>
                              setSelectedTagIds((current) =>
                                selected
                                  ? current.filter((id) => id !== tag.id)
                                  : [...current, tag.id],
                              )
                            }
                            selected={selected}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <Text tone="secondary" variant="caption">
                      {ptBR.transactions.noTags}
                    </Text>
                  )}
                </View>
                <View style={styles.group}>
                  <Text variant="label">{ptBR.transactions.attachments}</Text>
                  <View style={styles.attachmentActions}>
                    <Button
                      onPress={() =>
                        Alert.alert(ptBR.transactions.addAttachment, undefined, [
                          {
                            text: ptBR.transactions.takePhoto,
                            onPress: () => void pickImage('camera'),
                          },
                          {
                            text: ptBR.transactions.choosePhoto,
                            onPress: () => void pickImage('library'),
                          },
                          { text: ptBR.transactions.cancel, style: 'cancel' },
                        ])
                      }
                    >
                      {ptBR.transactions.addAttachment}
                    </Button>
                  </View>
                  {visibleAttachments.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.attachmentRow}>
                        {visibleAttachments.map((attachment) => (
                          <View key={attachment.id} style={styles.attachmentItem}>
                            <Pressable
                              accessibilityLabel={ptBR.transactions.viewAttachment}
                              accessibilityRole="button"
                              onPress={() => setPreviewUri(attachment.uri)}
                            >
                              <Image source={{ uri: attachment.uri }} style={styles.thumbnail} />
                            </Pressable>
                            <Pressable
                              accessibilityLabel={ptBR.transactions.removeAttachment}
                              accessibilityRole="button"
                              onPress={() => {
                                if (attachment.id.startsWith('new-')) {
                                  const index = Number(attachment.id.slice(4));
                                  setNewAttachments((current) =>
                                    current.filter((_, currentIndex) => currentIndex !== index),
                                  );
                                } else {
                                  setRemovedAttachmentIds((current) => [...current, attachment.id]);
                                }
                              }}
                              style={[
                                styles.removeAttachment,
                                { backgroundColor: colors.negative },
                              ]}
                            >
                              <Text style={{ color: colors.onPrimary }}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  ) : null}
                </View>
              </>
            ) : null}

            {error ? (
              <Text accessibilityRole="alert" tone="negative">
                {error}
              </Text>
            ) : null}
            <Button
              accessibilityHint="Salva o lançamento neste dispositivo"
              disabled={saving || availableAccounts.length === 0}
              haptic={!saving}
              loading={saving}
              onPress={() => void submit()}
            >
              {saving ? ptBR.transactions.saving : ptBR.transactions.save}
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        animationType={modalAnimationType}
        onRequestClose={() => setPreviewUri(null)}
        presentationStyle="fullScreen"
        visible={previewUri !== null}
      >
        <View style={[styles.preview, { backgroundColor: colors.background }]}>
          <Pressable
            accessibilityLabel={ptBR.transactions.closeAttachment}
            accessibilityRole="button"
            onPress={() => setPreviewUri(null)}
            style={[styles.previewClose, { backgroundColor: colors.surface }]}
          >
            <Text variant="heading">×</Text>
          </Pressable>
          {previewUri ? (
            <Image resizeMode="contain" source={{ uri: previewUri }} style={styles.previewImage} />
          ) : null}
        </View>
      </Modal>
    </Modal>
  );
}

function ChoiceGroup({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text variant="label">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.choiceRow}>
          {options.map((option) => (
            <ChoiceButton
              key={option.id || 'none'}
              label={option.label}
              onPress={() => onSelect(option.id)}
              selected={selectedId === option.id}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return paymentMethods.some((method) => method.value === value);
}

function ChoiceButton({
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
        styles.choice,
        {
          backgroundColor: selected ? colors.primarySubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text tone={selected ? 'primary' : 'secondary'} variant="label">
        {label}
      </Text>
    </Pressable>
  );
}

function FormField({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text variant="label">{label}</Text>
      <TextInput
        allowFontScaling
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
  },
  closeButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  amountCard: {
    borderRadius: radius.large,
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[1],
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[2],
  },
  key: {
    width: '30%',
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.medium,
  },
  group: {
    gap: spacing[2],
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingRight: spacing[2],
  },
  attachmentActions: {
    alignItems: 'flex-start',
  },
  attachmentRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  attachmentItem: {
    position: 'relative',
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: radius.medium,
  },
  removeAttachment: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: layout.touchTarget,
    justifyContent: 'center',
    position: 'absolute',
    right: -spacing[2],
    top: -spacing[2],
    width: layout.touchTarget,
  },
  preview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: layout.touchTarget,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing[4],
    top: spacing[8],
    width: layout.touchTarget,
    zIndex: 1,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  choice: {
    minHeight: layout.touchTarget,
    borderWidth: layout.borderWidth,
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  input: {
    minHeight: layout.touchTarget,
    borderWidth: layout.borderWidth,
    borderRadius: radius.medium,
    paddingHorizontal: spacing[3],
    fontSize: typography.size.body,
  },
});
