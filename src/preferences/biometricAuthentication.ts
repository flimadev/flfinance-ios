import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export function authenticateBiometrically(promptMessage: string, cancelLabel: string) {
  return LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel,
    ...(Platform.OS === 'ios' ? { disableDeviceFallback: true } : {}),
  });
}
