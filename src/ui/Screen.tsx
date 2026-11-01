import type { PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, spacing } from '@/src/theme';

type ScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}>;

export function Screen({
  children,
  scrollable = false,
  style,
  testID,
  contentContainerStyle,
}: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      testID={testID}
      style={[styles.safeArea, { backgroundColor: colors.background }, style]}
    >
      {scrollable ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing[4],
  },
});
