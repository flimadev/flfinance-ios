import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/src/theme';
import { Button } from './Button';
import { Text } from './Text';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <View
      accessibilityRole="summary"
      style={[styles.container, style]}
      accessible={!hasAction}
      accessibilityLabel={hasAction ? undefined : [title, description].filter(Boolean).join('. ')}
    >
      {icon ? (
        <View style={[styles.icon, { backgroundColor: colors.primarySubtle }]}>{icon}</View>
      ) : null}
      <Text variant="heading" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text tone="secondary" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  icon: {
    width: spacing[12],
    height: spacing[12],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[2],
  },
});
