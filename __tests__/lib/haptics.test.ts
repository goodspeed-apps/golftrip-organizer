/**
 * Tests for lib/haptics.ts
 */

const mockImpact = jest.fn(async () => {});
const mockNotification = jest.fn(async () => {});
const mockSelection = jest.fn(async () => {});
jest.mock('expo-haptics', () => ({
  impactAsync: mockImpact,
  notificationAsync: mockNotification,
  selectionAsync: mockSelection,
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));

import { lightTap, mediumTap, heavyTap, successFeedback, errorFeedback, selectionFeedback } from '../../lib/haptics';

beforeEach(() => jest.clearAllMocks());

describe('haptics', () => {
  test('lightTap calls impactAsync Light', () => {
    lightTap();
    expect(mockImpact).toHaveBeenCalledWith('Light');
  });

  test('mediumTap calls impactAsync Medium', () => {
    mediumTap();
    expect(mockImpact).toHaveBeenCalledWith('Medium');
  });

  test('heavyTap calls impactAsync Heavy', () => {
    heavyTap();
    expect(mockImpact).toHaveBeenCalledWith('Heavy');
  });

  test('successFeedback calls notificationAsync Success', () => {
    successFeedback();
    expect(mockNotification).toHaveBeenCalledWith('Success');
  });

  test('errorFeedback calls notificationAsync Error', () => {
    errorFeedback();
    expect(mockNotification).toHaveBeenCalledWith('Error');
  });

  test('selectionFeedback calls selectionAsync', () => {
    selectionFeedback();
    expect(mockSelection).toHaveBeenCalled();
  });
});
