import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import HomeScreen from '../app/(tabs)/index';
import { AppPreferencesProvider } from '../src/preferences/AppPreferencesProvider';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: <Component,>(component: Component) => component,
  },
  Easing: { cubic: 'cubic', out: (value: unknown) => value },
  useAnimatedProps: (callback: () => unknown) => callback(),
  useReducedMotion: () => false,
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Path: 'Path',
  Skia: { PathBuilder: { Make: jest.fn() } },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../src/features/dashboard/useDashboard', () => ({
  useDashboard: () => ({
    accounts: [],
    categories: [],
    transactions: [],
    loading: false,
    error: null,
    reload: jest.fn(),
  }),
}));

describe('HomeScreen', () => {
  it('renders the dashboard with its period and empty-state sections', async () => {
    const screen = await render(
      <AppPreferencesProvider>
        <HomeScreen />
      </AppPreferencesProvider>,
    );
    expect(screen.getByTestId('dashboard-screen')).toBeTruthy();
    expect(screen.getByText('Saldo total')).toBeTruthy();
    expect(screen.getByText('Gastos por categoria')).toBeTruthy();
    expect(screen.getByText('Últimos lançamentos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver dívidas' })).toBeTruthy();
    expect(screen.getByText('Nenhum lançamento neste período.')).toBeTruthy();
  });
});
