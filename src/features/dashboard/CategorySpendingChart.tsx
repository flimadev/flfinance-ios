import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

import type { DashboardCategoryTotal } from '@/src/domain/dashboard';
import { ptBR } from '@/src/i18n/pt-BR';
import { radius, spacing, useTheme } from '@/src/theme';
import { AmountText, Text } from '@/src/ui';

const chartSize = 224;
const chartBounds = { x: 14, y: 14, width: chartSize - 28, height: chartSize - 28 };
const chartStrokeWidth = 24;
const fallbackColors = ['#147A58', '#5071A5', '#D68B2C', '#B33E42', '#8466B2'];

type CategorySpendingChartProps = {
  categories: DashboardCategoryTotal[];
  totalCents: number;
};

export function CategorySpendingChart({ categories, totalCents }: CategorySpendingChartProps) {
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const chartCategories = useMemo(
    () =>
      categories.map((category, index) => ({
        ...category,
        color: category.color ?? fallbackColors[index % fallbackColors.length] ?? colors.primary,
      })),
    [categories, colors.primary],
  );
  const paths = useMemo(() => {
    if (totalCents <= 0) {
      return [];
    }

    let startAngle = -90;
    return chartCategories.map((category, index) => {
      const sweepAngle = (category.amountCents / totalCents) * 360;
      const path = Skia.PathBuilder.Make()
        .addArc(chartBounds, startAngle + 1, Math.max(sweepAngle - 2, 0))
        .detach();
      startAngle += sweepAngle;
      return { path, category, index };
    });
  }, [chartCategories, totalCents]);

  const activeIndex = Math.min(selectedIndex, Math.max(chartCategories.length - 1, 0));
  const selectAt = useCallback(
    (x: number, y: number) => {
      if (!chartCategories.length || totalCents <= 0) {
        return;
      }
      const center = chartSize / 2;
      const distance = Math.hypot(x - center, y - center);
      if (distance < 55 || distance > 112) {
        return;
      }

      const angle = (Math.atan2(y - center, x - center) * 180) / Math.PI;
      const normalizedAngle = (angle + 90 + 360) % 360;
      let accumulatedAngle = 0;

      for (let index = 0; index < chartCategories.length; index += 1) {
        const category = chartCategories[index];
        if (!category) {
          continue;
        }
        accumulatedAngle += (category.amountCents / totalCents) * 360;
        if (normalizedAngle < accumulatedAngle) {
          setSelectedIndex(index);
          return;
        }
      }
      setSelectedIndex(chartCategories.length - 1);
    },
    [chartCategories, totalCents],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 4,
        onPanResponderMove: (event) =>
          selectAt(event.nativeEvent.locationX, event.nativeEvent.locationY),
      }),
    [selectAt],
  );
  const selectedCategory = chartCategories[activeIndex];

  if (!categories.length || totalCents <= 0) {
    return (
      <View style={styles.emptyChart}>
        <Text tone="secondary">{ptBR.dashboard.noCategorySpending}</Text>
      </View>
    );
  }

  return (
    <View>
      <View
        accessibilityActions={[
          { name: 'decrement', label: ptBR.dashboard.previousCategory },
          { name: 'increment', label: ptBR.dashboard.nextCategory },
        ]}
        accessibilityHint={ptBR.dashboard.chartScrubHint}
        accessibilityLabel={ptBR.dashboard.categoryChart}
        accessibilityRole="adjustable"
        accessibilityValue={{
          text: selectedCategory
            ? `${selectedCategory.name}, ${new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(selectedCategory.amountCents / 100)}`
            : '',
        }}
        onAccessibilityAction={(event) => {
          const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
          setSelectedIndex(
            (activeIndex + direction + chartCategories.length) % chartCategories.length,
          );
        }}
        style={styles.chartContainer}
        {...panResponder.panHandlers}
        onTouchStart={(event) => selectAt(event.nativeEvent.locationX, event.nativeEvent.locationY)}
      >
        <Canvas style={styles.canvas}>
          {paths.map(({ path, category, index }) => (
            <Path
              color={category.color}
              key={category.categoryId ?? category.name}
              opacity={activeIndex === index ? 1 : 0.62}
              path={path}
              strokeCap="round"
              strokeWidth={chartStrokeWidth}
              style="stroke"
            />
          ))}
        </Canvas>
        <View pointerEvents="none" style={styles.chartCenter}>
          <Text numberOfLines={1} variant="caption" tone="secondary">
            {selectedCategory?.name ?? ptBR.dashboard.expenses}
          </Text>
          <AmountText
            amountCents={selectedCategory?.amountCents ?? totalCents}
            numberOfLines={1}
            style={styles.chartAmount}
            variant="label"
          />
        </View>
      </View>
      <View style={styles.categoryList}>
        {chartCategories.map((category, index) => {
          const percentage = Math.round((category.amountCents / totalCents) * 100);
          return (
            <Pressable
              accessibilityLabel={`${category.name}, ${percentage}%`}
              accessibilityRole="button"
              accessibilityState={{ selected: activeIndex === index }}
              key={category.categoryId ?? category.name}
              onPress={() => setSelectedIndex(index)}
              style={[
                styles.categoryRow,
                {
                  backgroundColor: activeIndex === index ? colors.surfaceSubtle : colors.surface,
                },
              ]}
            >
              <View style={styles.categoryLabel}>
                <View style={[styles.swatch, { backgroundColor: category.color }]} />
                <Text numberOfLines={1} variant="label">
                  {category.name}
                </Text>
              </View>
              <View style={styles.categoryAmount}>
                <AmountText amountCents={category.amountCents} variant="label" />
                <Text variant="caption" tone="secondary">
                  {percentage}%
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyChart: {
    alignItems: 'center',
    minHeight: chartSize,
    justifyContent: 'center',
    padding: spacing[4],
  },
  chartContainer: {
    alignSelf: 'center',
    height: chartSize,
    width: chartSize,
  },
  canvas: {
    height: chartSize,
    width: chartSize,
  },
  chartCenter: {
    alignItems: 'center',
    height: chartSize - chartStrokeWidth * 2,
    justifyContent: 'center',
    left: chartStrokeWidth,
    position: 'absolute',
    top: chartStrokeWidth,
    width: chartSize - chartStrokeWidth * 2,
  },
  chartAmount: {
    fontSize: 16,
  },
  categoryList: {
    gap: spacing[1],
    marginTop: spacing[2],
  },
  categoryRow: {
    alignItems: 'center',
    borderRadius: radius.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing[2],
  },
  categoryLabel: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minWidth: 0,
  },
  swatch: {
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  categoryAmount: {
    alignItems: 'flex-end',
    gap: spacing[1],
    marginLeft: spacing[2],
  },
});
