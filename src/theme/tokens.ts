import { Easing, type ViewStyle } from 'react-native';

export const colors = {
  light: {
    background: '#F5F8F6',
    surface: '#FFFFFF',
    surfaceSubtle: '#EDF2EF',
    text: '#17251E',
    textSecondary: '#58675E',
    textMuted: '#626E66',
    border: '#DDE6E0',
    primary: '#147A58',
    primaryPressed: '#0E6347',
    primarySubtle: '#E4F3EC',
    onPrimary: '#FFFFFF',
    positive: '#18764F',
    positiveSubtle: '#E5F4EB',
    negative: '#B33E42',
    negativeSubtle: '#FCEBED',
    overlay: 'rgba(20, 35, 27, 0.48)',
  },
  dark: {
    background: '#101713',
    surface: '#18221C',
    surfaceSubtle: '#222E27',
    text: '#F1F6F2',
    textSecondary: '#B6C2B9',
    textMuted: '#8E9D93',
    border: '#334139',
    primary: '#70D5A7',
    primaryPressed: '#8CE2B9',
    primarySubtle: '#203C2E',
    onPrimary: '#10251A',
    positive: '#83D8A5',
    positiveSubtle: '#203A2B',
    negative: '#FF9999',
    negativeSubtle: '#43272A',
    overlay: 'rgba(0, 0, 0, 0.64)',
  },
} as const;

export type AppColorScheme = keyof typeof colors;
export type ThemeColors = (typeof colors)[AppColorScheme];

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  small: 8,
  medium: 14,
  large: 20,
  xlarge: 28,
  pill: 999,
} as const;

export const typography = {
  size: {
    caption: 12,
    label: 14,
    body: 16,
    heading: 20,
    title: 28,
    display: 36,
  },
  lineHeight: {
    caption: 16,
    label: 20,
    body: 24,
    heading: 26,
    title: 34,
    display: 42,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  letterSpacing: {
    display: -1,
    title: -0.5,
  },
} as const;

export const elevation = {
  card: {
    shadowColor: '#14231B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  } satisfies ViewStyle,
  floating: {
    shadowColor: '#14231B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  } satisfies ViewStyle,
} as const;

export const motion = {
  duration: {
    quick: 120,
    standard: 220,
    deliberate: 360,
  },
  spring: {
    damping: 18,
    stiffness: 180,
    mass: 0.8,
  },
  easing: {
    standard: Easing.inOut(Easing.ease),
    enter: Easing.out(Easing.cubic),
    exit: Easing.in(Easing.cubic),
  },
} as const;

export const layout = {
  touchTarget: 44,
  borderWidth: 1,
  pressedOpacity: 0.82,
  disabledOpacity: 0.55,
} as const;
