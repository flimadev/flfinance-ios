import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ptBR } from '@/src/i18n/pt-BR';
import { radius, useTheme } from '@/src/theme';

type SkeletonProps = {
  width: ViewStyle['width'];
  height: ViewStyle['height'];
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width,
  height,
  radius: borderRadius = radius.small,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={ptBR.accessibility.loadingContent}
      style={[
        styles.skeleton,
        { width, height, borderRadius, backgroundColor: colors.surfaceSubtle },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
