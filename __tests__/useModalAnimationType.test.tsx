import { renderHook } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useModalAnimationType } from '../src/ui/useModalAnimationType';

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: jest.fn(),
}));

const mockUseReducedMotion = jest.mocked(useReducedMotion);

describe('useModalAnimationType', () => {
  it.each([
    [true, 'none'],
    [false, 'slide'],
  ] as const)('uses %s motion preference', async (reduceMotion, expectedAnimation) => {
    mockUseReducedMotion.mockReturnValue(reduceMotion);

    const { result } = await renderHook(() => useModalAnimationType());

    expect(result.current).toBe(expectedAnimation);
  });
});
