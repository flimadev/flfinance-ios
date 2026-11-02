import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Alert, AppState, Platform, StyleSheet, View } from 'react-native';

import { ptBR } from '@/src/i18n/pt-BR';
import { spacing } from '@/src/theme';
import { Button, Screen, Text } from '@/src/ui';
import { useAppPreferences } from './AppPreferencesProvider';
import { authenticateBiometrically } from './biometricAuthentication';

export function AppLockGate({ children }: PropsWithChildren) {
  const {
    preferences,
    ready,
    error: preferencesError,
    reloadPreferences,
    resetPreferences,
    updatePreferences,
  } = useAppPreferences();
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(true);
  const attemptActive = useRef(false);
  const wasBackgrounded = useRef(false);

  const authenticate = useCallback(async () => {
    if (attemptActive.current || Platform.OS === 'web') {
      return;
    }

    attemptActive.current = true;
    try {
      const result = await authenticateBiometrically(
        ptBR.settings.biometricPrompt,
        ptBR.settings.cancel,
      );
      setAuthError(null);
      if (result.success) {
        setUnlocked(true);
      } else {
        setAuthError(ptBR.settings.authenticationRequired);
      }
    } catch (error) {
      console.error('Não foi possível autenticar o acesso ao app.', error);
      setAuthError(error instanceof Error ? error.message : ptBR.errors.unexpected);
    } finally {
      attemptActive.current = false;
    }
  }, []);

  function confirmDisableBiometricLock() {
    Alert.alert(ptBR.settings.disableBiometricTitle, ptBR.settings.disableBiometricDescription, [
      { text: ptBR.settings.cancel, style: 'cancel' },
      {
        text: ptBR.settings.disableBiometricLock,
        style: 'destructive',
        onPress: () => {
          void updatePreferences({ biometricLock: false }).catch((error: unknown) => {
            console.error('Não foi possível desativar o bloqueio biométrico.', error);
            setAuthError(ptBR.settings.biometricEnableError);
          });
        },
      },
    ]);
  }

  useEffect(() => {
    if (ready && appActive && !preferencesError && preferences.biometricLock && !unlocked) {
      const frame = requestAnimationFrame(() => {
        void authenticate();
      });
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [appActive, authenticate, preferences.biometricLock, preferencesError, ready, unlocked]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (!preferences.biometricLock || Platform.OS === 'web') {
        return;
      }
      if (state !== 'active') {
        setAppActive(false);
        wasBackgrounded.current = true;
        setUnlocked(false);
        return;
      }
      setAppActive(true);
      if (wasBackgrounded.current) {
        wasBackgrounded.current = false;
        setAuthError(null);
      }
    });
    return () => subscription.remove();
  }, [preferences.biometricLock]);

  if (!ready || preferencesError || (preferences.biometricLock && !unlocked)) {
    return (
      <Screen>
        <View style={styles.content}>
          <Text variant="title">
            {preferencesError ? ptBR.settings.preferencesErrorTitle : ptBR.settings.appLocked}
          </Text>
          <Text tone="secondary">
            {preferencesError
              ? ptBR.settings.preferencesReadError
              : (authError ?? ptBR.settings.unlockDescription)}
          </Text>
          {preferencesError ? (
            <>
              <Button
                haptic={false}
                onPress={() => {
                  void reloadPreferences().catch((error: unknown) => {
                    console.error('Não foi possível recarregar as preferências seguras.', error);
                  });
                }}
              >
                {ptBR.settings.retry}
              </Button>
              <Button
                haptic={false}
                variant="secondary"
                onPress={() => {
                  void resetPreferences().catch((error: unknown) => {
                    console.error('Não foi possível redefinir as preferências seguras.', error);
                  });
                }}
              >
                {ptBR.settings.resetPreferences}
              </Button>
            </>
          ) : preferences.biometricLock ? (
            <>
              <Button
                onPress={() => void authenticate()}
                accessibilityHint={ptBR.settings.unlockDescription}
              >
                {ptBR.settings.unlock}
              </Button>
              {authError ? (
                <Button haptic={false} variant="secondary" onPress={confirmDisableBiometricLock}>
                  {ptBR.settings.disableBiometricLock}
                </Button>
              ) : null}
            </>
          ) : null}
        </View>
      </Screen>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing[4],
    justifyContent: 'center',
  },
});
