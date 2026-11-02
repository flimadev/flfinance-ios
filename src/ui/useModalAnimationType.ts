import type { ModalProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useModalAnimationType(): NonNullable<ModalProps['animationType']> {
  return useReducedMotion() ? 'none' : 'slide';
}
