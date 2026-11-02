import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { getDatabase } from '@/src/db/client';
import { ptBR } from '@/src/i18n/pt-BR';
import { useAppPreferences, type ThemeMode } from '@/src/preferences/AppPreferencesProvider';
import { BackupRepository } from '@/src/repositories/BackupRepository';
import { BackupService } from '@/src/services/BackupService';
import { pickBackupContents, shareTextFile } from '@/src/services/BackupFileService';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { Button, Card, Screen, Text } from '@/src/ui';

type Operation = 'backup' | 'restore' | 'csv' | null;

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: ptBR.settings.themeSystem },
  { value: 'light', label: ptBR.settings.themeLight },
  { value: 'dark', label: ptBR.settings.themeDark },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'backup-too-large') return ptBR.settings.backupTooLarge;
    if (error.message === 'invalid-backup') return ptBR.settings.invalidBackup;
    if (error.message === 'share-unavailable' || error.message === 'file-picker-unavailable') {
      return ptBR.settings.fileSharingUnavailable;
    }
  }
  return ptBR.settings.operationError;
}

function getBackupService() {
  return getDatabase().then((database) => new BackupService(new BackupRepository(database)));
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { preferences, updatePreferences } = useAppPreferences();
  const [operation, setOperation] = useState<Operation>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function changeBiometricLock(enabled: boolean) {
    setMessage(null);
    if (!enabled) {
      try {
        await updatePreferences({ biometricLock: false });
      } catch (error) {
        console.error('Não foi possível desativar o bloqueio biométrico.', error);
        setMessage(ptBR.settings.operationError);
      }
      return;
    }
    if (Platform.OS === 'web') {
      setMessage(ptBR.settings.biometricUnavailable);
      return;
    }

    try {
      const [hardwareAvailable, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hardwareAvailable || !enrolled) {
        setMessage(ptBR.settings.biometricUnavailable);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: ptBR.settings.biometricPrompt,
        cancelLabel: ptBR.settings.cancel,
      });
      if (!result.success) {
        setMessage(ptBR.settings.authenticationRequired);
        return;
      }
      await updatePreferences({ biometricLock: true });
    } catch (error) {
      console.error('Não foi possível ativar o bloqueio biométrico.', error);
      setMessage(ptBR.settings.biometricEnableError);
    }
  }

  async function exportBackup() {
    setOperation('backup');
    setMessage(null);
    try {
      const service = await getBackupService();
      const contents = await service.createBackup();
      const filename = `flfinance-backup-${Date.now()}.json`;
      await shareTextFile(contents, filename, 'application/json', ptBR.settings.exportBackup);
      setMessage(ptBR.settings.exportSuccess);
    } catch (error) {
      console.error('Não foi possível exportar o backup.', error);
      setMessage(getErrorMessage(error));
    } finally {
      setOperation(null);
    }
  }

  async function exportCsv() {
    setOperation('csv');
    setMessage(null);
    try {
      const service = await getBackupService();
      const contents = await service.createCsv();
      await shareTextFile(
        contents,
        `flfinance-transacoes-${Date.now()}.csv`,
        'text/csv',
        ptBR.settings.exportCsv,
      );
      setMessage(ptBR.settings.exportSuccess);
    } catch (error) {
      console.error('Não foi possível exportar os lançamentos CSV.', error);
      setMessage(getErrorMessage(error));
    } finally {
      setOperation(null);
    }
  }

  async function restoreBackup() {
    setOperation('restore');
    setMessage(null);
    try {
      const contents = await pickBackupContents();
      if (contents === null) {
        setMessage(ptBR.settings.noBackupSelected);
        return;
      }
      const service = await getBackupService();
      await service.restoreBackup(contents);
      setMessage(ptBR.settings.restoreSuccess);
    } catch (error) {
      console.error('Não foi possível restaurar o backup.', error);
      setMessage(getErrorMessage(error));
    } finally {
      setOperation(null);
    }
  }

  function confirmRestore() {
    if (Platform.OS === 'web') {
      setMessage(ptBR.settings.fileSharingUnavailable);
      return;
    }
    Alert.alert(ptBR.settings.importWarningTitle, ptBR.settings.importWarningDescription, [
      { text: ptBR.settings.cancelRestore, style: 'cancel' },
      {
        text: ptBR.settings.confirmRestore,
        style: 'destructive',
        onPress: () => void restoreBackup(),
      },
    ]);
  }

  async function updateTheme(themeMode: ThemeMode) {
    setMessage(null);
    try {
      await updatePreferences({ themeMode });
    } catch (error) {
      console.error('Não foi possível salvar o tema selecionado.', error);
      setMessage(ptBR.settings.operationError);
    }
  }

  async function updateMonthStartDay(monthStartDay: number) {
    setMessage(null);
    try {
      await updatePreferences({ monthStartDay });
    } catch (error) {
      console.error('Não foi possível salvar o dia de início do mês.', error);
      setMessage(ptBR.settings.operationError);
    }
  }

  return (
    <Screen scrollable contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title">{ptBR.settings.title}</Text>
        <Text tone="secondary">{ptBR.settings.description}</Text>
      </View>

      <Card style={styles.section}>
        <Text variant="heading">{ptBR.settings.appearance}</Text>
        <Text variant="label">{ptBR.settings.theme}</Text>
        <View style={styles.themeOptions}>
          {themeOptions.map((option) => {
            const selected = preferences.themeMode === option.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => void updateTheme(option.value)}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: selected ? colors.primarySubtle : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text tone={selected ? 'primary' : 'secondary'} variant="label">
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.daySetting}>
          <View style={styles.dayText}>
            <Text variant="label">{ptBR.settings.monthStart}</Text>
            <Text tone="secondary" variant="caption">
              {ptBR.settings.monthStartDescription}
            </Text>
          </View>
          <View style={styles.dayStepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ptBR.settings.previousDay}
              disabled={preferences.monthStartDay <= 1}
              onPress={() => void updateMonthStartDay(preferences.monthStartDay - 1)}
              style={styles.stepButton}
            >
              <SymbolView
                name={{ ios: 'minus', android: 'remove', web: 'remove' }}
                tintColor={colors.primary}
                size={20}
              />
            </Pressable>
            <Text variant="label">{ptBR.settings.day(preferences.monthStartDay)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ptBR.settings.nextDay}
              disabled={preferences.monthStartDay >= 28}
              onPress={() => void updateMonthStartDay(preferences.monthStartDay + 1)}
              style={styles.stepButton}
            >
              <SymbolView
                name={{ ios: 'plus', android: 'add', web: 'add' }}
                tintColor={colors.primary}
                size={20}
              />
            </Pressable>
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text variant="heading">{ptBR.settings.security}</Text>
        <View style={styles.securityRow}>
          <View style={styles.securityText}>
            <Text variant="label">{ptBR.settings.biometricLock}</Text>
            <Text tone="secondary" variant="caption">
              {ptBR.settings.biometricDescription}
            </Text>
          </View>
          <Switch
            accessibilityLabel={ptBR.settings.biometricLock}
            disabled={operation !== null || Platform.OS === 'web'}
            onValueChange={(enabled) => void changeBiometricLock(enabled)}
            value={preferences.biometricLock}
          />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text variant="heading">{ptBR.settings.backup}</Text>
        <Text tone="secondary">{ptBR.settings.backupDescription}</Text>
        <Button
          loading={operation === 'backup'}
          disabled={operation !== null}
          onPress={() => void exportBackup()}
        >
          {ptBR.settings.exportBackup}
        </Button>
        <Button
          variant="secondary"
          loading={operation === 'restore'}
          disabled={operation !== null}
          onPress={confirmRestore}
        >
          {ptBR.settings.importBackup}
        </Button>
        <Button
          variant="secondary"
          loading={operation === 'csv'}
          disabled={operation !== null}
          onPress={() => void exportCsv()}
        >
          {ptBR.settings.exportCsv}
        </Button>
        {message ? (
          <Text
            accessibilityRole={message === ptBR.settings.operationError ? 'alert' : undefined}
            tone={
              message === ptBR.settings.restoreSuccess || message === ptBR.settings.exportSuccess
                ? 'positive'
                : 'negative'
            }
          >
            {message}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  header: {
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  section: {
    gap: spacing[4],
  },
  themeOptions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  themeOption: {
    minHeight: layout.touchTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.borderWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2],
  },
  daySetting: {
    gap: spacing[2],
  },
  dayText: {
    gap: spacing[1],
  },
  dayStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  securityText: {
    flex: 1,
    gap: spacing[1],
  },
});
