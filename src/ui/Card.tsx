import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { elevation, layout, radius, spacing, useTheme } from '@/src/theme';

type CardProps = PropsWithChildren<{
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, onPress, accessibilityLabel, style }: CardProps) {
  const { colors } = useTheme();
  const cardStyle = [
    styles.card,
    elevation.card,
    { backgroundColor: colors.surface, borderColor: colors.border },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.large,
    borderWidth: layout.borderWidth,
    padding: spacing[5],
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
});
