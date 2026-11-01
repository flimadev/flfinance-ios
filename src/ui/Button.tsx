import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import * as Haptics from 'expo-haptics';

import { layout, radius, spacing, typography, useTheme } from '@/src/theme';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  haptic = true,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const palette = buttonPalette[variant];
  const backgroundColor = colors[palette.background];
  const foregroundColor = colors[palette.foreground];

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(event) => {
        if (haptic) {
          triggerHapticFeedback();
        }

        onPress?.(event);
      }}
      onPressIn={(event) => {
        setPressed(true);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        props.onPressOut?.(event);
      }}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'secondary' ? colors.border : backgroundColor,
          opacity: isDisabled ? layout.disabledOpacity : pressed ? layout.pressedOpacity : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <Text
          variant="label"
          style={{ color: foregroundColor, fontWeight: typography.weight.semibold }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

function triggerHapticFeedback() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error: unknown) => {
      console.error('Não foi possível reproduzir o feedback tátil do botão.', error);
    });
  } catch (error) {
    console.error('Não foi possível iniciar o feedback tátil do botão.', error);
  }
}

const buttonPalette = {
  primary: { background: 'primary', foreground: 'onPrimary' },
  secondary: { background: 'surface', foreground: 'text' },
  ghost: { background: 'background', foreground: 'primary' },
  destructive: { background: 'negative', foreground: 'onPrimary' },
} as const;

const styles = StyleSheet.create({
  button: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
  },
});
