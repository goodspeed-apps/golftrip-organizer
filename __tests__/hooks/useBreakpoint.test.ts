import { useBreakpoint } from '../../hooks/useBreakpoint';

const mockUseWindowDimensions = jest.fn();

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

describe('useBreakpoint', () => {
  test('returns phone when width < tablet threshold', () => {
    mockUseWindowDimensions.mockReturnValue({ width: 375, height: 812 });
    expect(useBreakpoint()).toBe('phone');
  });

  test('returns tablet when width >= 600 and < 1024', () => {
    mockUseWindowDimensions.mockReturnValue({ width: 768, height: 1024 });
    expect(useBreakpoint()).toBe('tablet');
  });

  test('returns desktop when width >= 1024', () => {
    mockUseWindowDimensions.mockReturnValue({ width: 1280, height: 800 });
    expect(useBreakpoint()).toBe('desktop');
  });
});