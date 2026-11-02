import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DebtItem } from '@/src/features/debts/useDebts';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { Card, Text } from '@/src/ui';

type Props = {
  debts: DebtItem[];
  monthOffset: number;
  selectedDate: string | null;
  onMonthOffsetChange: (offset: number) => void;
  onSelectDate: (date: string | null) => void;
};

function toLocalDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function DueDateCalendar({
  debts,
  monthOffset,
  selectedDate,
  onMonthOffsetChange,
  onSelectDate,
}: Props) {
  const { colors } = useTheme();
  const today = new Date();
  const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    monthDate,
  );
  const leadingDays = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const countByDate = new Map<string, number>();
  for (const debt of debts) {
    countByDate.set(debt.dueDate, (countByDate.get(debt.dueDate) ?? 0) + 1);
  }

  return (
    <Card style={styles.card}>
      <Text variant="heading">{ptBR.debts.calendar}</Text>
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ptBR.debts.previousMonth}
          onPress={() => {
            onMonthOffsetChange(monthOffset - 1);
            onSelectDate(null);
          }}
          style={styles.monthButton}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            tintColor={colors.primary}
          />
        </Pressable>
        <Text accessibilityLiveRegion="polite" variant="label">
          {monthName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ptBR.debts.nextMonth}
          onPress={() => {
            onMonthOffsetChange(monthOffset + 1);
            onSelectDate(null);
          }}
          style={styles.monthButton}
        >
          <SymbolView
            name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
            size={18}
            tintColor={colors.primary}
          />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {ptBR.debts.weekdays.map((weekday) => (
          <View key={weekday} style={styles.cell}>
            <Text accessibilityLabel={weekday} tone="secondary" variant="caption">
              {weekday}
            </Text>
          </View>
        ))}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - leadingDays + 1;
          if (day < 1 || day > daysInMonth) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }

          const date = toLocalDateString(year, month, day);
          const count = countByDate.get(date) ?? 0;
          const selected = date === selectedDate;
          const dateLabel = new Intl.DateTimeFormat('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(year, month, day));
          return (
            <Pressable
              accessibilityLabel={ptBR.debts.dayWithDueItems(dateLabel, count)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={date}
              onPress={() => onSelectDate(selected ? null : date)}
              style={[
                styles.cell,
                styles.dayCell,
                selected
                  ? { backgroundColor: colors.primary, borderRadius: radius.medium }
                  : count > 0
                    ? { backgroundColor: colors.primarySubtle, borderRadius: radius.medium }
                    : undefined,
              ]}
            >
              <Text
                style={selected ? { color: colors.onPrimary } : undefined}
                tone={count > 0 ? 'primary' : 'default'}
                variant={count > 0 ? 'label' : 'caption'}
              >
                {day}
              </Text>
              {count > 0 ? (
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: selected ? colors.onPrimary : colors.primary },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    height: layout.touchTarget,
    justifyContent: 'center',
    width: layout.touchTarget,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchTarget,
    width: '14.2857%',
  },
  dayCell: {
    gap: spacing[0],
  },
  dot: {
    borderRadius: radius.pill,
    height: spacing[1],
    width: spacing[1],
  },
});
