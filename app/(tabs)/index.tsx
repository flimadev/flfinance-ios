import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/src/theme';
import { Button, Screen, Text } from '@/src/ui';

export default function HomeScreen() {
  return (
    <Screen testID="empty-tab-screen">
      <View style={styles.content}>
        <Text variant="heading">Fundação do app</Text>
        <Text tone="secondary">A Fase 1 prepara os componentes visuais do Finanças.</Text>
        <Link href="/dev/ui" asChild>
          <Button accessibilityHint="Abre o catálogo visual de componentes do app">
            Abrir catálogo de UI
          </Button>
        </Link>
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
