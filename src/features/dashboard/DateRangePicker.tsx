import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { DashboardPeriod } from '@/src/domain/dashboard';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { Button, Text } from '@/src/ui';
import { useModalAnimationType } from '@/src/ui/useModalAnimationType';

type DateRangePickerProps = {
  initialRange: DashboardPeriod;
  onCancel: () => void;
  onApply: (range: DashboardPeriod) => void;
};

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarDays(month: Date): Date[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstVisibleDay = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);

  return Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        firstVisibleDay.getFullYear(),
        firstVisibleDay.getMonth(),
        firstVisibleDay.getDate() + index,
      ),
  );
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return ptBR.dashboard.selectDate;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseLocalDate(value));
}

export function DateRangePicker({ initialRange, onCancel, onApply }: DateRangePickerProps) {
  const { colors } = useTheme();
  const modalAnimationType = useModalAnimationType();
  const [visibleMonth, setVisibleMonth] = useState(() => parseLocalDate(initialRange.fromDate));
  const [startDate, setStartDate] = useState<string | null>(initialRange.fromDate);
  const [endDate, setEndDate] = useState<string | null>(initialRange.toDate);

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonth);

  function selectDate(date: Date) {
    const selected = formatLocalDate(date);
    if (!startDate || endDate) {
      setStartDate(selected);
      setEndDate(null);
    } else if (selected < startDate) {
      setStartDate(selected);
      setEndDate(startDate);
    } else {
      setEndDate(selected);
    }
  }

  function changeMonth(offset: number) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  return (
    <Modal animationType={modalAnimationType} onRequestClose={onCancel} transparent visible>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <ScrollView
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.panel, { backgroundColor: colors.surface }]}>
            <Text variant="heading">{ptBR.dashboard.customPeriodTitle}</Text>
            <Text tone="secondary">{ptBR.dashboard.customPeriodDescription}</Text>
            <View style={styles.rangeLabels}>
              <View style={styles.rangeLabel}>
                <Text variant="caption" tone="muted">
                  {ptBR.dashboard.startDate}
                </Text>
                <Text variant="label">{formatDateLabel(startDate)}</Text>
              </View>
              <View style={styles.rangeLabel}>
                <Text variant="caption" tone="muted">
                  {ptBR.dashboard.endDate}
                </Text>
                <Text variant="label">{formatDateLabel(endDate)}</Text>
              </View>
            </View>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityLabel={ptBR.dashboard.previousCalendarMonth}
                accessibilityRole="button"
                onPress={() => changeMonth(-1)}
                style={styles.monthButton}
              >
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                  size={20}
                  tintColor={colors.text}
                />
              </Pressable>
              <Text variant="label">{monthLabel}</Text>
              <Pressable
                accessibilityLabel={ptBR.dashboard.nextCalendarMonth}
                accessibilityRole="button"
                onPress={() => changeMonth(1)}
                style={styles.monthButton}
              >
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={20}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {ptBR.dashboard.weekdays.map((weekday) => (
                <View key={weekday} style={styles.calendarCell}>
                  <Text variant="caption" tone="muted">
                    {weekday}
                  </Text>
                </View>
              ))}
              {calendarDays.map((date) => {
                const dateValue = formatLocalDate(date);
                const isSelected = dateValue === startDate || dateValue === endDate;
                const isBetween = Boolean(
                  startDate && endDate && dateValue > startDate && dateValue < endDate,
                );
                const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();

                return (
                  <Pressable
                    accessibilityLabel={formatDateLabel(dateValue)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={dateValue}
                    onPress={() => selectDate(date)}
                    style={[
                      styles.calendarCell,
                      isBetween && { backgroundColor: colors.primarySubtle },
                      isSelected && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      tone={isSelected ? 'default' : isCurrentMonth ? 'default' : 'muted'}
                      style={isSelected ? { color: colors.onPrimary } : undefined}
                      variant="label"
                    >
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.actions}>
              <Button onPress={onCancel} variant="secondary">
                {ptBR.dashboard.cancel}
              </Button>
              <Button
                accessibilityHint={ptBR.dashboard.applyPeriodHint}
                disabled={!startDate || !endDate}
                onPress={() => {
                  if (startDate && endDate) {
                    onApply({ fromDate: startDate, toDate: endDate });
                  }
                }}
              >
                {ptBR.dashboard.applyPeriod}
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[4],
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  panel: {
    borderRadius: radius.xlarge,
    gap: spacing[4],
    padding: spacing[5],
  },
  rangeLabels: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  rangeLabel: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
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
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'flex-end',
  },
});
