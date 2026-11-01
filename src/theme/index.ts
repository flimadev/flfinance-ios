import { useAppColorScheme } from './ThemePreviewProvider';
import { colors } from './tokens';

export { useAppColorScheme } from './ThemePreviewProvider';
export { ThemePreviewProvider } from './ThemePreviewProvider';
export { colors, elevation, layout, motion, radius, spacing, typography } from './tokens';
export type { AppColorScheme, ThemeColors } from './tokens';

export function useTheme() {
  const scheme = useAppColorScheme();

  return { scheme, colors: colors[scheme] };
}
