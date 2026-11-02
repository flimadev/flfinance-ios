import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { StatementColumnMapping, StatementImportRow } from '@/src/domain/statementImport';
import type { PickedStatement } from '@/src/services/StatementFileService';
import { pickStatementFile } from '@/src/services/StatementFileService';
import { useStatementImport } from '@/src/features/reports/useStatementImport';
import { formatCurrencyCents } from '@/src/domain/money';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { AmountText, Button, Card, Screen, Text } from '@/src/ui';

function getImportErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return ptBR.statementImport.importError;
  }
  switch (error.message) {
    case 'file-picker-unavailable':
      return ptBR.statementImport.noPermission;
    case 'unsupported-statement-format':
      return ptBR.statementImport.unsupportedFormat;
    case 'statement-file-too-large':
      return ptBR.statementImport.fileTooLarge;
    case 'statement-too-many-rows':
      return ptBR.statementImport.tooManyRows;
    case 'invalid-statement-date':
      return ptBR.statementImport.invalidDate;
    case 'invalid-statement-amount':
    case 'statement-amount-too-large':
      return ptBR.statementImport.invalidAmount;
    case 'invalid-statement-row':
      return ptBR.statementImport.invalidRow;
    case 'invalid-statement-file':
      return ptBR.statementImport.invalidFile;
    default:
      return ptBR.statementImport.importError;
  }
}

function getMappedRows(statement: PickedStatement['statement']): StatementImportRow[] {
  return statement.format === 'ofx'
    ? statement.rows
    : mapStatementRows(statement.rows, statement.mapping);
}

import { mapStatementRows } from '@/src/domain/statementImport';

export default function StatementImportScreen() {
  const { colors } = useTheme();
  const { accounts, error, importRows, loading, reload } = useStatementImport();
  const [picked, setPicked] = useState<PickedStatement | null>(null);
  const [accountId, setAccountId] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const availableAccounts = accounts.filter(
    (account) => account.deletedAt === null && account.archivedAt === null,
  );
  const previewResult = useMemo(() => {
    if (!picked) {
      return { rows: [] as StatementImportRow[], error: null as string | null };
    }
    try {
      return { rows: getMappedRows(picked.statement), error: null };
    } catch (mappingError) {
      return { rows: [] as StatementImportRow[], error: getImportErrorMessage(mappingError) };
    }
  }, [picked]);

  useEffect(() => {
    if (!accountId && availableAccounts[0]) {
      setAccountId(availableAccounts[0].id);
    }
  }, [accountId, availableAccounts]);

  async function chooseFile() {
    setPicking(true);
    setFileError(null);
    setOperationError(null);
    setSuccess(null);
    try {
      const selected = await pickStatementFile();
      if (selected) {
        setPicked(selected);
      }
    } catch (pickError) {
      console.error('Não foi possível abrir ou ler o extrato selecionado.', pickError);
      setFileError(getImportErrorMessage(pickError));
    } finally {
      setPicking(false);
    }
  }

  function updateMapping(
    key: keyof Pick<
      StatementColumnMapping,
      'dateColumn' | 'descriptionColumn' | 'amountColumn' | 'kindColumn' | 'amountInCents'
    >,
    value: number | boolean | null,
  ) {
    setPicked((current) => {
      if (!current || current.statement.format === 'ofx') {
        return current;
      }
      return {
        ...current,
        statement: {
          ...current.statement,
          mapping: {
            ...current.statement.mapping,
            [key]: value,
          } as StatementColumnMapping,
        },
      };
    });
  }

  async function importSelectedRows() {
    if (!accountId) {
      setOperationError(ptBR.statementImport.accountRequired);
      return;
    }
    if (!previewResult.rows.length) {
      setOperationError(previewResult.error ?? ptBR.statementImport.emptyPreview);
      return;
    }
    setImporting(true);
    setOperationError(null);
    setSuccess(null);
    try {
      const result = await importRows(previewResult.rows, accountId);
      setSuccess(ptBR.statementImport.importSuccess(result.imported.length, result.skippedDuplicates));
      setPicked(null);
    } catch (importError) {
      console.error('Não foi possível importar os lançamentos do extrato.', importError);
      setOperationError(getImportErrorMessage(importError));
    } finally {
      setImporting(false);
    }
  }

  const header = (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text variant="title">{ptBR.statementImport.title}</Text>
          <Text tone="secondary">{ptBR.statementImport.description}</Text>
        </View>
        <Button haptic={false} onPress={() => router.back()} variant="secondary">
          {ptBR.dashboard.back}
        </Button>
      </View>

      <Button loading={picking} onPress={() => void chooseFile()} variant="secondary">
        {ptBR.statementImport.chooseFile}
      </Button>
      {picked ? (
        <Card style={styles.fileCard}>
          <Text variant="label">{picked.name}</Text>
          <Text tone="secondary" variant="caption">
            {ptBR.statementImport.previewCount(previewResult.rows.length)}
          </Text>
        </Card>
      ) : (
        <Text tone="secondary">{ptBR.statementImport.noFile}</Text>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel={ptBR.statementImport.loading} color={colors.primary} />
          <Text accessibilityRole="progressbar">{ptBR.statementImport.loading}</Text>
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Text accessibilityRole="alert" tone="negative">
            {ptBR.statementImport.loadError}: {error}
          </Text>
          <Button haptic={false} onPress={() => void reload()} variant="secondary">
            {ptBR.statementImport.retry}
          </Button>
        </Card>
      ) : (
        <>
          <Text variant="label">{ptBR.statementImport.chooseAccount}</Text>
          <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false}>
            {availableAccounts.map((account) => (
              <ChoiceChip
                key={account.id}
                label={account.name}
                selected={account.id === accountId}
                onPress={() => setAccountId(account.id)}
              />
            ))}
          </ScrollView>
        </>
      )}

      {picked && picked.statement.format !== 'ofx' ? (
        <Card style={styles.mappingCard}>
          <Text variant="heading">{ptBR.statementImport.preview}</Text>
          <ColumnSelector
            title={ptBR.statementImport.dateColumn}
            headers={picked.statement.headers}
            selected={picked.statement.mapping.dateColumn}
            onChange={(column) => updateMapping('dateColumn', column)}
          />
          <ColumnSelector
            title={ptBR.statementImport.descriptionColumn}
            headers={picked.statement.headers}
            selected={picked.statement.mapping.descriptionColumn}
            onChange={(column) => updateMapping('descriptionColumn', column)}
          />
          <ColumnSelector
            title={ptBR.statementImport.amountColumn}
            headers={picked.statement.headers}
            selected={picked.statement.mapping.amountColumn}
            onChange={(column) => updateMapping('amountColumn', column)}
          />
          <ColumnSelector
            title={ptBR.statementImport.kindColumn}
            headers={picked.statement.headers}
            selected={picked.statement.mapping.kindColumn}
            allowNone
            onChange={(column) => updateMapping('kindColumn', column)}
          />
          <ChoiceChip
            label={
              picked.statement.mapping.amountInCents
                ? ptBR.statementImport.amountInCents
                : ptBR.statementImport.amountInCurrency
            }
            selected={picked.statement.mapping.amountInCents}
            onPress={() =>
              updateMapping('amountInCents', !picked.statement.mapping.amountInCents)
            }
          />
        </Card>
      ) : null}
      {fileError || previewResult.error || operationError ? (
        <Text accessibilityRole="alert" tone="negative">
          {fileError ?? previewResult.error ?? operationError}
        </Text>
      ) : null}
      {success ? (
        <Text accessibilityLiveRegion="polite" tone="positive">
          {success}
        </Text>
      ) : null}
      {picked ? (
        <Text variant="heading">{ptBR.statementImport.preview}</Text>
      ) : null}
    </View>
  );

  return (
    <Screen testID="statement-import-screen">
      <FlashList
        contentContainerStyle={styles.listContent}
        data={previewResult.rows}
        keyExtractor={(row, index) => `${row.date}:${row.kind}:${row.amountCents}:${index}`}
        ListEmptyComponent={
          picked ? (
            <Text tone="secondary">{ptBR.statementImport.emptyPreview}</Text>
          ) : null
        }
        ListFooterComponent={
          picked ? (
            <Button
              disabled={
                importing ||
                picking ||
                loading ||
                !accountId ||
                previewResult.rows.length === 0 ||
                Boolean(previewResult.error)
              }
              loading={importing}
              onPress={() => void importSelectedRows()}
            >
              {ptBR.statementImport.import}
            </Button>
          ) : null
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => <StatementRow row={item} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function ColumnSelector({
  title,
  headers,
  selected,
  allowNone = false,
  onChange,
}: {
  title: string;
  headers: string[];
  selected: number | null;
  allowNone?: boolean;
  onChange: (selected: number | null) => void;
}) {
  const selectedLabel =
    selected === null ? ptBR.statementImport.noKindColumn : (headers[selected] ?? '');
  return (
    <Pressable
      accessibilityHint={ptBR.statementImport.nextColumn}
      accessibilityLabel={`${title}: ${selectedLabel}`}
      accessibilityRole="button"
      onPress={() => {
        if (selected === null) {
          onChange(0);
        } else if (selected < headers.length - 1) {
          onChange(selected + 1);
        } else {
          onChange(allowNone ? null : 0);
        }
      }}
      style={styles.mappingRow}
    >
      <Text tone="secondary" variant="caption">{title}</Text>
      <Text numberOfLines={1} variant="label">{selectedLabel}</Text>
    </Pressable>
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

function StatementRow({ row }: { row: StatementImportRow }) {
  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionDescription}>
        <Text numberOfLines={1} variant="label">{row.description}</Text>
        <Text tone="secondary" variant="caption">{row.date}</Text>
      </View>
      <AmountText
        amountCents={row.kind === 'expense' ? -row.amountCents : row.amountCents}
        tone={row.kind === 'expense' ? 'negative' : 'positive'}
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
  chips: {
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
  fileCard: {
    gap: spacing[2],
  },
  mappingCard: {
    gap: spacing[2],
  },
  mappingRow: {
    borderBottomWidth: layout.borderWidth,
    gap: spacing[1],
    justifyContent: 'center',
    minHeight: layout.touchTarget,
    paddingVertical: spacing[1],
  },
  loading: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  errorCard: {
    alignItems: 'flex-start',
    gap: spacing[3],
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
  transactionDescription: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
});
