import { render } from '@testing-library/react-native';

import HomeScreen from '../app/(tabs)/index';

describe('HomeScreen', () => {
  it('renders the empty foundation screen', async () => {
    const screen = await render(<HomeScreen />);
    expect(screen.getByTestId('empty-tab-screen')).toBeTruthy();
  });
});
