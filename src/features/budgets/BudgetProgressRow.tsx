import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { BudgetSummaryRow } from '@/src/domain/budgets';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { AmountText, Button, Card, Text, formatCurrencyCents } from '@/src/ui';

type BudgetProgressRowProps = {
  row: BudgetSummaryRow;
  onEdit: () => void;
};

export function BudgetProgressRow({ row, onEdit }: BudgetProgressRowProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reduceMotion ? row.progress : withTiming(row.progress, { duration: 360 });
  }, [progress, reduceMotion, row.progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const amountLabel = row.budget
    ? formatCurrencyCents(row.budget.amountCents)
    : ptBR.budgets.noLimit;

  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.categoryInfo}>
          <View style={[styles.colorDot, { backgroundColor: row.category.color }]} />
          <Text numberOfLines={1} variant="heading">
            {row.category.name}
          </Text>
        </View>
        {row.budget ? (
          <Text
            accessibilityLabel={
              row.isOverBudget ? ptBR.budgets.overBudget : ptBR.budgets.withinBudget
            }
            tone={row.isOverBudget ? 'negative' : 'secondary'}
            variant="caption"
          >
            {row.isOverBudget ? ptBR.budgets.exceeded : ptBR.budgets.withinLimit}
          </Text>
        ) : null}
      </View>

      <View style={styles.amountRow}>
        <View style={styles.amountColumn}>
          <Text tone="secondary" variant="caption">
            {ptBR.budgets.spent}
          </Text>
          <AmountText
            amountCents={row.spentCents}
            tone={row.isOverBudget ? 'negative' : 'default'}
            variant="label"
          />
        </View>
        <View style={[styles.amountColumn, styles.limitColumn]}>
          <Text tone="secondary" variant="caption">
            {ptBR.budgets.monthlyLimit}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: row.isOverBudget ? colors.negative : colors.text }}
            variant="label"
          >
            {amountLabel}
          </Text>
        </View>
      </View>

      {row.budget ? (
        <View
          accessibilityLabel={ptBR.budgets.progressAccessibility(
            Math.round((row.spentCents / row.budget.amountCents) * 100),
          )}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: row.budget.amountCents,
            now: row.spentCents,
            text: row.isOverBudget ? ptBR.budgets.exceeded : ptBR.budgets.withinLimit,
          }}
          style={[styles.progressTrack, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: row.isOverBudget ? colors.negative : row.category.color },
              progressStyle,
            ]}
          />
        </View>
      ) : null}

      <Button
        accessibilityLabel={`${row.budget ? ptBR.budgets.edit : ptBR.budgets.define} ${row.category.name}`}
        haptic={false}
        onPress={onEdit}
        style={styles.actionButton}
        variant="secondary"
      >
        {row.budget ? ptBR.budgets.edit : ptBR.budgets.define}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
    padding: spacing[4],
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  categoryInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minWidth: 0,
  },
  colorDot: {
    borderRadius: radius.pill,
    height: spacing[3],
    width: spacing[3],
  },
  amountRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  amountColumn: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  limitColumn: {
    alignItems: 'flex-end',
  },
  progressTrack: {
    borderRadius: radius.pill,
    height: spacing[2],
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  actionButton: {
    alignSelf: 'flex-end',
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[4],
  },
});
