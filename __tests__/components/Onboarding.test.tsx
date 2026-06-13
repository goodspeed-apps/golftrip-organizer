import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { OnboardingProvider, useOnboarding } from '../../components/onboarding/OnboardingProvider';
import { OnboardingStep } from '../../components/onboarding/OnboardingStep';
import { OnboardingControls } from '../../components/onboarding/OnboardingControls';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom: jest.Mock<any, [string]> = jest.fn((_table: string) => ({
  update: jest.fn(() => ({
    eq: jest.fn(async () => ({ error: null })),
  })),
  // OnboardingProvider now reads profiles.onboarded_at before deciding which
  // direction to sync; default to null so the legacy "push local up to
  // server" path still runs in tests that set a local value.
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    })),
  })),
}));
const mockGetSession: jest.Mock = jest.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } }));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: (table: string) => mockFrom(table),
  },
  getCurrentUserId: async () => {
    const res = await mockGetSession();
    return res?.data?.session?.user?.id ?? null;
  },
}));

function TestHarness({ steps = 3, onComplete = jest.fn() }: { steps?: number; onComplete?: jest.Mock }) {
  return (
    <OnboardingProvider steps={steps} onComplete={onComplete}>
      <OnboardingStep index={0}><></></OnboardingStep>
      <OnboardingStep index={1}><></></OnboardingStep>
      <OnboardingStep index={2}><></></OnboardingStep>
      <OnboardingControls />
    </OnboardingProvider>
  );
}

describe('Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('steps navigate forward and back', async () => {
    const { getByText } = await render(<TestHarness />);
    // On step 0: shows Skip and Next
    expect(getByText('Skip')).toBeTruthy();
    expect(getByText('Next')).toBeTruthy();

    // React 19 + testing-library v14 are stricter about flushing state. Press
    // events that trigger setState need to settle inside act() before the next
    // query runs, otherwise the new text is queried mid-render.
    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    // On step 1: shows Back and Next
    expect(getByText('Back')).toBeTruthy();
    expect(getByText('Next')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Back'));
    });
    // Back on step 0
    expect(getByText('Skip')).toBeTruthy();
  });

  test('skip on first step calls complete and persists', async () => {
    const onComplete = jest.fn();
    const { getByText } = await render(<TestHarness onComplete={onComplete} />);
    await act(async () => {
      fireEvent.press(getByText('Skip'));
    });
expect(mockGetSession).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('complete on last step persists onboarded_at', async () => {
    const onComplete = jest.fn();
    const { getByText } = await render(<TestHarness steps={2} onComplete={onComplete} />);
    // Navigate to last step (act-wrapped so the step-change setState flushes
    // before we query for the next button's label).
    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    // Now on last step
    expect(getByText('Get started')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('Get started'));
    });
    expect(mockGetSession).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});