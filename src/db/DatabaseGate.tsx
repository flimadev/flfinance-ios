import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ptBR } from '@/src/i18n/pt-BR';
import { spacing, useTheme } from '@/src/theme';
import { Button, Screen, Text } from '@/src/ui';
import { initializeDatabase } from './initialize';

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: string };

export function DatabaseGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const { colors } = useTheme();

  useEffect(() => {
    let active = true;

    async function prepareDatabase() {
      setState({ status: 'loading' });

      try {
        await initializeDatabase();
        if (active) {
          setState({ status: 'ready' });
        }
      } catch (error) {
        console.error('Não foi possível preparar o banco local.', error);
        if (active) {
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void prepareDatabase();
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state.status === 'ready') {
    return children;
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <View style={styles.content}>
          <Text variant="heading">{ptBR.database.errorTitle}</Text>
          <Text tone="secondary">{ptBR.database.errorDescription}</Text>
          <Text accessibilityRole="alert" tone="muted">
            {state.error}
          </Text>
          <Button
            accessibilityHint="Tenta abrir o banco local novamente"
            onPress={() => setAttempt((current) => current + 1)}
          >
            {ptBR.database.retry}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <ActivityIndicator
          accessibilityLabel={ptBR.database.loading}
          color={colors.primary}
          size="large"
        />
        <Text accessibilityLiveRegion="polite" tone="secondary">
          {ptBR.database.loading}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing[3],
  },
});
