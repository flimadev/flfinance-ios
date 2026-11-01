import { createContext, useContext, type PropsWithChildren } from 'react';

import { useColorScheme } from '@/components/useColorScheme';

import type { AppColorScheme } from './tokens';

const ThemeOverrideContext = createContext<AppColorScheme | null>(null);

export function ThemePreviewProvider({
  scheme,
  children,
}: PropsWithChildren<{ scheme: AppColorScheme }>) {
  return <ThemeOverrideContext.Provider value={scheme}>{children}</ThemeOverrideContext.Provider>;
}

export function useAppColorScheme(): AppColorScheme {
  const override = useContext(ThemeOverrideContext);
  const systemScheme = useColorScheme();

  return override ?? systemScheme;
}
