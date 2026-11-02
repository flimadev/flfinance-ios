import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { Budget, Category } from '@/src/db/schema';
import { parseCurrencyDigitsToCents } from '@/src/domain/transactions';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { AmountText, Button, Text } from '@/src/ui';

type BudgetEditorSheetProps = {
  category: Category;
  budget: Budget | null;
  monthLabel: string;
  error: string | null;
  onClose: () => void;
  onSave: (amountCents: number) => Promise<void>;
};

const keypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['erase', '0', 'clear'],
] as const;

export function BudgetEditorSheet({
  category,
  budget,
  monthLabel,
  error,
  onClose,
  onSave,
}: BudgetEditorSheetProps) {
  const { colors } = useTheme();
  const [digits, setDigits] = useState(() => (budget ? String(budget.amountCents) : ''));
  const [saving, setSaving] = useState(false);
  const amountCents = parseCurrencyDigitsToCents(digits) ?? 0;

  function pressKey(key: (typeof keypadRows)[number][number]) {
    if (key === 'erase') {
      setDigits((current) => current.slice(0, -1));
    } else if (key === 'clear') {
      setDigits('');
    } else {
      setDigits((current) => {
        const next = `${current}${key}`.replace(/^0+(?=\d)/, '');
        return parseCurrencyDigitsToCents(next) === null ? current : next;
      });
    }
  }

  async function save() {
    if (amountCents <= 0) {
      return;
    }
    setSaving(true);
    try {
      await onSave(amountCents);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.panel, { backgroundColor: colors.surface }]}>
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text variant="heading">
                  {budget ? ptBR.budgets.editTitle : ptBR.budgets.createTitle}
                </Text>
                <Text numberOfLines={1} tone="secondary">
                  {category.name} · {monthLabel}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={ptBR.budgets.closeEditor}
                accessibilityRole="button"
                onPress={onClose}
                style={styles.closeButton}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={20}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>
            <Text tone="secondary" variant="label">
              {ptBR.budgets.monthlyLimit}
            </Text>
            <View
              accessibilityLabel={ptBR.budgets.amount}
              style={[styles.amountDisplay, { borderColor: colors.border }]}
            >
              <AmountText amountCents={amountCents} variant="title" />
            </View>
            <View style={styles.keypad}>
              {keypadRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keypadRow}>
                  {row.map((key) => (
                    <Pressable
                      accessibilityLabel={
                        key === 'erase'
                          ? ptBR.budgets.eraseDigit
                          : key === 'clear'
                            ? ptBR.budgets.clearAmount
                            : ptBR.budgets.addDigit(key)
                      }
                      accessibilityRole="button"
                      key={key}
                      onPress={() => pressKey(key)}
                      style={({ pressed }) => [
                        styles.key,
                        { backgroundColor: colors.surfaceSubtle },
                        pressed && styles.keyPressed,
                      ]}
                    >
                      {key === 'erase' ? (
                        <SymbolView
                          name={{ ios: 'delete.left', android: 'backspace', web: 'backspace' }}
                          size={20}
                          tintColor={colors.text}
                        />
                      ) : key === 'clear' ? (
                        <Text variant="label">{ptBR.budgets.clearKey}</Text>
                      ) : (
                        <Text variant="heading">{key}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
            {error ? (
              <Text accessibilityRole="alert" tone="negative">
                {error}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button haptic={false} onPress={onClose} variant="secondary">
                {ptBR.budgets.cancel}
              </Button>
              <Button
                accessibilityHint={ptBR.budgets.saveHint}
                disabled={amountCents <= 0}
                loading={saving}
                onPress={() => void save()}
              >
                {ptBR.budgets.save}
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[4],
  },
  modalContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  panel: {
    borderRadius: radius.xlarge,
    gap: spacing[3],
    padding: spacing[5],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  closeButton: {
    alignItems: 'center',
    height: layout.touchTarget,
    justifyContent: 'center',
    width: layout.touchTarget,
  },
  amountDisplay: {
    alignItems: 'center',
    borderRadius: radius.large,
    borderWidth: layout.borderWidth,
    justifyContent: 'center',
    minHeight: spacing[16],
    padding: spacing[3],
  },
  keypad: {
    gap: spacing[2],
  },
  keypadRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  key: {
    alignItems: 'center',
    borderRadius: radius.medium,
    flex: 1,
    height: spacing[12],
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: layout.pressedOpacity,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'flex-end',
    marginTop: spacing[1],
  },
});
