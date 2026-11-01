import { Link, Stack } from 'expo-router';

import { Button, Screen, Text } from '@/src/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <Screen>
        <Text variant="heading">Esta página não foi encontrada.</Text>
        <Link href="/" asChild>
          <Button variant="secondary">Voltar ao início</Button>
        </Link>
      </Screen>
    </>
  );
}
