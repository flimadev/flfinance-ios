import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { DatabaseGate } from '@/src/db/DatabaseGate';
import { AppLockGate } from '@/src/preferences/AppLockGate';
import { AppPreferencesProvider } from '@/src/preferences/AppPreferencesProvider';
import { colors as themeColors, useTheme } from '@/src/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppPreferencesProvider>
      <DatabaseGate>
        <AppLockGate>
          <RootLayoutNav />
        </AppLockGate>
      </DatabaseGate>
    </AppPreferencesProvider>
  );
}

function RootLayoutNav() {
  const { scheme } = useTheme();
  const router = useRouter();
  const handledNotificationIds = useRef(new Set<string>());
  const colors = themeColors[scheme];
  const navigationTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.negative,
    },
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    function openDebtsFromNotification(response: Notifications.NotificationResponse) {
      const request = response.notification.request;
      if (
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER &&
        request.content.data?.screen === 'debts' &&
        !handledNotificationIds.current.has(request.identifier)
      ) {
        handledNotificationIds.current.add(request.identifier);
        router.push('/debts');
        void Notifications.clearLastNotificationResponseAsync().catch((error: unknown) => {
          console.error('Não foi possível limpar o último destino de notificação.', error);
        });
      }
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(openDebtsFromNotification);
    let active = true;
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && response) {
          openDebtsFromNotification(response);
        }
      })
      .catch((error: unknown) => {
        console.error('Não foi possível abrir o destino do lembrete.', error);
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="debts" options={{ headerShown: false }} />
          <Stack.Screen name="categories" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
