import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Pressable } from 'react-native';

import {
  AppPreferencesProvider,
  useAppPreferences,
} from '../src/preferences/AppPreferencesProvider';
import { authenticateBiometrically } from '../src/preferences/biometricAuthentication';
import { Text } from '../src/ui';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

function PreferencesProbe() {
  const { preferences, ready, updatePreferences } = useAppPreferences();
  return (
    <>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="theme">{preferences.themeMode}</Text>
      <Text testID="month-start">{String(preferences.monthStartDay)}</Text>
      <Pressable
        testID="update"
        onPress={() => {
          void updatePreferences({ monthStartDay: 15 });
          void updatePreferences({ themeMode: 'dark' });
        }}
      />
    </>
  );
}

describe('app preferences', () => {
  beforeEach(() => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(
        JSON.stringify({ themeMode: 'light', monthStartDay: 5, biometricLock: false }),
      );
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  });

  it('loads persisted settings and saves user changes securely', async () => {
    const screen = await render(
      <AppPreferencesProvider>
        <PreferencesProbe />
      </AppPreferencesProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').props.children).toBe('true');
      expect(screen.getByTestId('theme').props.children).toBe('light');
      expect(screen.getByTestId('month-start').props.children).toBe('5');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('update'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
        'flfinance.preferences.v1',
        JSON.stringify({ themeMode: 'dark', monthStartDay: 15, biometricLock: false }),
      );
      expect(screen.getByTestId('theme').props.children).toBe('dark');
      expect(screen.getByTestId('month-start').props.children).toBe('15');
    });
  });

  it('disables the iOS device passcode fallback when prompting for biometrics', async () => {
    await authenticateBiometrically('Autentique-se', 'Cancelar');

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Autentique-se',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: true,
      }),
    );
  });
});
