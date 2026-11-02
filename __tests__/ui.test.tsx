import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemePreviewProvider, colors } from '../src/theme';
import { AmountText, Button, formatCurrencyCents, Skeleton, Text } from '../src/ui';
import UiCatalogScreen from '../app/dev/ui';

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.slice(1).match(/.{2}/g);
    if (!channels || channels.length !== 3) {
      throw new RangeError(`Cor inválida para cálculo de contraste: ${color}`);
    }

    const [red, green, blue] = channels
      .map((channel) => parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      );

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const first = luminance(foreground);
  const second = luminance(background);

  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('design system', () => {
  it('formats integer cents as Brazilian currency', () => {
    expect(formatCurrencyCents(123456)).toBe('R$ 1.234,56');
    expect(formatCurrencyCents(-50)).toBe('-R$ 0,50');
  });

  it('rejects non-integer monetary values', () => {
    expect(() => formatCurrencyCents(1.5)).toThrow(RangeError);
  });

  it.each(['light', 'dark'] as const)('uses the %s semantic text color', async (scheme) => {
    const screen = await render(
      <ThemePreviewProvider scheme={scheme}>
        <Text>Teste de tema</Text>
      </ThemePreviewProvider>,
    );

    expect(StyleSheet.flatten(screen.getByText('Teste de tema').props.style)).toMatchObject({
      color: colors[scheme].text,
    });
  });

  it.each(['light', 'dark'] as const)('meets AA contrast for %s semantic text', (scheme) => {
    const palette = colors[scheme];
    const textTones = [
      'text',
      'textSecondary',
      'textMuted',
      'primary',
      'positive',
      'negative',
    ] as const;
    const surfaces = ['background', 'surface', 'surfaceSubtle'] as const;

    for (const tone of textTones) {
      for (const surface of surfaces) {
        expect(contrastRatio(palette[tone], palette[surface])).toBeGreaterThanOrEqual(4.5);
      }
    }

    expect(contrastRatio(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.onPrimary, palette.negative)).toBeGreaterThanOrEqual(4.5);
  });

  it('renders formatted amounts with an accessible label', async () => {
    const screen = await render(
      <ThemePreviewProvider scheme="light">
        <AmountText amountCents={123456} />
      </ThemePreviewProvider>,
    );

    expect(screen.getByLabelText('R$ 1.234,56')).toBeTruthy();
  });

  it('announces skeleton loading with the localized accessibility label', async () => {
    const screen = await render(
      <ThemePreviewProvider scheme="light">
        <Skeleton width={48} height={48} />
      </ThemePreviewProvider>,
    );

    expect(screen.getByRole('progressbar', { name: 'Carregando conteúdo' })).toBeTruthy();
  });

  it('keeps buttons operable and exposes a press action', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <ThemePreviewProvider scheme="light">
        <Button haptic={false} onPress={onPress}>
          Confirmar
        </Button>
      </ThemePreviewProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('previews both themes and the empty-state action in the UI catalog', async () => {
    const screen = await render(<UiCatalogScreen />);

    expect(screen.getByText('Claro')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Alternar' }));
    expect(screen.getByText('Escuro')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver exemplo' }));
    expect(screen.getByText('Pronto para começar')).toBeTruthy();
  });

  it('keeps Dynamic Type enabled by default', async () => {
    const screen = await render(
      <ThemePreviewProvider scheme="light">
        <Text>Texto escalável</Text>
      </ThemePreviewProvider>,
    );

    expect(screen.getByText('Texto escalável').props.allowFontScaling).toBe(true);
  });
});
