import { StyleSheet, Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { useTheme, typography } from '@/src/theme';

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
type TextTone = 'default' | 'secondary' | 'muted' | 'primary' | 'positive' | 'negative';

const toneColor = {
  default: 'text',
  secondary: 'textSecondary',
  muted: 'textMuted',
  primary: 'primary',
  positive: 'positive',
  negative: 'negative',
} as const;

export type TextProps = NativeTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  tabularNumbers?: boolean;
};

export function Text({
  variant = 'body',
  tone = 'default',
  tabularNumbers = false,
  style,
  ...props
}: TextProps) {
  const { colors } = useTheme();
  const color = colors[toneColor[tone]];

  return (
    <NativeText
      allowFontScaling
      {...props}
      style={[styles[variant], { color }, tabularNumbers && styles.tabularNumbers, style]}
    />
  );
}

const styles = StyleSheet.create({
  display: {
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.display,
  },
  title: {
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.title,
  },
  heading: {
    fontSize: typography.size.heading,
    lineHeight: typography.lineHeight.heading,
    fontWeight: typography.weight.semibold,
  },
  body: {
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.regular,
  },
  label: {
    fontSize: typography.size.label,
    lineHeight: typography.lineHeight.label,
    fontWeight: typography.weight.medium,
  },
  caption: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.regular,
  },
  tabularNumbers: {
    fontVariant: ['tabular-nums'],
  },
});
