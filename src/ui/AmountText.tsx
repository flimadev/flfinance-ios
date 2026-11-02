import { StyleSheet } from 'react-native';

import { useTheme } from '@/src/theme';
import { formatCurrencyCents } from '@/src/domain/money';
import { Text, type TextProps } from './Text';

type AmountTextProps = Omit<TextProps, 'children' | 'tabularNumbers' | 'tone'> & {
  amountCents: number;
  tone?: 'default' | 'positive' | 'negative';
};

export { formatCurrencyCents };

export function AmountText({ amountCents, tone = 'default', style, ...props }: AmountTextProps) {
  const { colors } = useTheme();
  const color =
    tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : colors.text;
  const formattedAmount = formatCurrencyCents(amountCents);

  return (
    <Text
      {...props}
      accessibilityLabel={props.accessibilityLabel ?? formattedAmount}
      tabularNumbers
      style={[styles.amount, { color }, style]}
    >
      {formattedAmount}
    </Text>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontVariant: ['tabular-nums'],
  },
});
