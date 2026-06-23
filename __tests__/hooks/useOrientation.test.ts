import { useOrientation } from '../../hooks/useOrientation';

const mockUseWindowDimensions = jest.fn();

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

describe('useOrientation', () => {
  test('returns portrait when height > width', () => {
    mockUseWindowDimensions.mockReturnValue({ width: 375, height: 812 });
    expect(useOrientation()).toBe('portrait');
  });

  test('returns landscape when width > height', () => {
    mockUseWindowDimensions.mockReturnValue({ width: 812, height: 375 });
    expect(useOrientation()).toBe('landscape');
  });
});