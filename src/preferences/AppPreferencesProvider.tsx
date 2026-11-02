import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import { z } from 'zod';

import type { AppColorScheme } from '@/src/theme/tokens';

export type ThemeMode = 'system' | AppColorScheme;

export type AppPreferences = {
  themeMode: ThemeMode;
  monthStartDay: number;
  biometricLock: boolean;
};

type AppPreferencesContextValue = {
  preferences: AppPreferences;
  ready: boolean;
  error: string | null;
  updatePreferences: (changes: Partial<AppPreferences>) => Promise<void>;
  reloadPreferences: () => Promise<void>;
  resetPreferences: () => Promise<void>;
  scheme: AppColorScheme;
};

const storageKey = 'flfinance.preferences.v1';
const defaults: AppPreferences = {
  themeMode: 'system',
  monthStartDay: 1,
  biometricLock: false,
};
const preferencesSchema = z
  .object({
    themeMode: z.enum(['system', 'light', 'dark']),
    monthStartDay: z.number().int().min(1).max(28),
    biometricLock: z.boolean(),
  })
  .strict();

const PreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferences] = useState(defaults);
  const preferencesRef = useRef(defaults);
  const writes = useRef(Promise.resolve());
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [error, setError] = useState<string | null>(null);

  const reloadPreferences = useCallback(async () => {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      const saved = await SecureStore.getItemAsync(storageKey);
      if (saved !== null) {
        const loaded = preferencesSchema.parse(JSON.parse(saved));
        preferencesRef.current = loaded;
        setPreferences(loaded);
      } else {
        preferencesRef.current = defaults;
        setPreferences(defaults);
      }
      setError(null);
    } catch (loadError) {
      console.error('Não foi possível carregar as preferências seguras.', loadError);
      setError(
        loadError instanceof Error ? loadError.message : 'Não foi possível ler as preferências.',
      );
    } finally {
      setReady(true);
    }
  }, []);

  const resetPreferences = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(storageKey);
    }
    preferencesRef.current = defaults;
    setPreferences(defaults);
    setError(null);
    setReady(true);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void reloadPreferences();
    });
    return () => cancelAnimationFrame(frame);
  }, [reloadPreferences]);

  const updatePreferences = useCallback((changes: Partial<AppPreferences>) => {
    const operation = writes.current.then(async () => {
      const updated = preferencesSchema.parse({ ...preferencesRef.current, ...changes });
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(storageKey, JSON.stringify(updated));
      }
      preferencesRef.current = updated;
      setPreferences(updated);
      setError(null);
    });
    writes.current = operation.catch(() => undefined);
    return operation;
  }, []);

  const scheme: AppColorScheme =
    preferences.themeMode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preferences.themeMode;

  const value = useMemo(
    () => ({
      preferences,
      ready,
      error,
      updatePreferences,
      reloadPreferences,
      resetPreferences,
      scheme,
    }),
    [preferences, ready, error, updatePreferences, reloadPreferences, resetPreferences, scheme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences deve ser usado dentro de AppPreferencesProvider.');
  }
  return context;
}

export function usePreferencesColorScheme(): AppColorScheme {
  const context = useContext(PreferencesContext);
  const systemScheme = useColorScheme();
  if (!context) {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return context.scheme;
}
