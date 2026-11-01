import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { type AppColorScheme, radius, spacing, ThemePreviewProvider, useTheme } from '@/src/theme';
import { AmountText, Button, Card, EmptyState, Screen, Skeleton, Text } from '@/src/ui';

export default function UiCatalogScreen() {
  const [scheme, setScheme] = useState<AppColorScheme>('light');

  return (
    <ThemePreviewProvider scheme={scheme}>
      <CatalogContent
        scheme={scheme}
        onToggleScheme={() => setScheme((current) => (current === 'light' ? 'dark' : 'light'))}
      />
    </ThemePreviewProvider>
  );
}

function CatalogContent({
  scheme,
  onToggleScheme,
}: {
  scheme: AppColorScheme;
  onToggleScheme: () => void;
}) {
  const { colors } = useTheme();
  const [showEmptyState, setShowEmptyState] = useState(true);

  return (
    <Screen
      scrollable
      contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Link href="/" asChild>
          <Button
            variant="ghost"
            accessibilityHint="Volta para o início do app"
            style={styles.backButton}
          >
            Voltar ao início
          </Button>
        </Link>
        <Text variant="caption" tone="primary">
          SISTEMA DE DESIGN
        </Text>
        <Text variant="title">Componentes</Text>
        <Text tone="secondary">
          Elementos essenciais do app, adaptados ao tema e ao tamanho de texto do sistema.
        </Text>
      </View>

      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="label">Tema atual</Text>
            <Text tone="secondary">{scheme === 'light' ? 'Claro' : 'Escuro'}</Text>
          </View>
          <Button variant="secondary" onPress={onToggleScheme}>
            Alternar
          </Button>
        </View>
      </Card>

      <View style={styles.section}>
        <Text variant="heading">Tipografia</Text>
        <Text variant="display">R$ 8.420</Text>
        <Text variant="title">Visão financeira</Text>
        <Text variant="body">Acompanhe seu dinheiro com clareza.</Text>
        <Text variant="caption" tone="muted">
          Rótulos e informações auxiliares
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="heading">Botões</Text>
        <Button onPress={() => undefined}>Ação principal</Button>
        <Button variant="secondary" onPress={() => undefined}>
          Ação secundária
        </Button>
        <Button variant="ghost" onPress={() => undefined}>
          Ação discreta
        </Button>
        <Button variant="destructive" onPress={() => undefined}>
          Ação destrutiva
        </Button>
      </View>

      <View style={styles.section}>
        <Text variant="heading">Cartão e valores</Text>
        <Card>
          <Text tone="secondary">Saldo disponível</Text>
          <AmountText amountCents={842057} variant="title" />
          <View style={styles.row}>
            <Text tone="positive">+ R$ 2.450,00</Text>
            <Text tone="negative">− R$ 830,00</Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="heading">Carregamento</Text>
        <Card>
          <View style={styles.skeletonRow}>
            <Skeleton width={spacing[12]} height={spacing[12]} radius={radius.pill} />
            <View style={styles.flex}>
              <Skeleton width="68%" height={spacing[3]} />
              <Skeleton width="42%" height={spacing[3]} />
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="heading">Estado vazio</Text>
        <Card>
          {showEmptyState ? (
            <EmptyState
              title="Tudo em dia por aqui"
              description="Seus lançamentos recentes vão aparecer nesta área."
              icon={
                <Text variant="title" tone="primary">
                  +
                </Text>
              }
              actionLabel="Ver exemplo"
              onAction={() => setShowEmptyState(false)}
            />
          ) : (
            <EmptyState
              title="Pronto para começar"
              description="O estado vazio também pode ser restaurado."
              actionLabel="Restaurar exemplo"
              onAction={() => setShowEmptyState(true)}
            />
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[6],
    paddingBottom: spacing[10],
  },
  header: {
    gap: spacing[2],
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  section: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  flex: {
    flex: 1,
    gap: spacing[2],
  },
});
