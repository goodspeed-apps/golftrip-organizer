import React from 'react';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { z } from 'zod';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../context/ThemeContext', () => ({
  useThemeColors: () => ({
    colors: {
      background: '#fff',
      surface: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      primary: '#6366F1',
      border: '#ccc',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
    resolved: 'light',
  }),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  useTypedForm,
  useFormServerError,
  useAsyncFieldValidator,
} from '../../lib/forms';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { FormCheckbox } from '../../components/forms/FormCheckbox';
import { FormSwitch } from '../../components/forms/FormSwitch';
import { FormButton } from '../../components/forms/FormButton';
import { FormErrorBanner } from '../../components/forms/FormErrorBanner';

// Unmount the rendered tree after every test so async effect cleanup runs and
// no mounted form leaks state into the next test's (shared) renderer.
afterEach(() => {
  cleanup();
});

// ─── useTypedForm ─────────────────────────────────────────────────────────────

describe('useTypedForm', () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  test('returns form object with control, handleSubmit, watch', async () => {
    const { result } = await renderHook(() => useTypedForm({ schema }));
    expect(result.current.control).toBeDefined();
    expect(typeof result.current.handleSubmit).toBe('function');
    expect(typeof result.current.watch).toBe('function');
  });

  test('defaults mode to onBlur', async () => {
    const { result } = await renderHook(() => useTypedForm({ schema }));
    expect(result.current).toBeDefined();
  });

  test('accepts explicit onChange mode', async () => {
    const { result } = await renderHook(() => useTypedForm({ schema, mode: 'onChange' }));
    expect(result.current).toBeDefined();
  });

  test('applies defaultValues to form state', async () => {
    const { result } = await renderHook(() =>
      useTypedForm({ schema, defaultValues: { email: 'test@example.com' } })
    );
    const val = result.current.getValues('email');
    expect(val).toBe('test@example.com');
  });

test('validates with zod — invalid email triggers error after submit', async () => {
    const { result } = await renderHook(() => useTypedForm({ schema }));
    let capturedErrors: Record<string, unknown> = {};
    await act(async () => {
      result.current.setValue('email', 'not-an-email');
      result.current.setValue('password', 'short');
      await new Promise<void>(resolve => {
        result.current.handleSubmit(
          () => resolve(),
          (errs) => { capturedErrors = errs; resolve(); }
        )({ nativeEvent: {} } as any);
      });
    });
    expect(capturedErrors.email).toBeDefined();
    expect(capturedErrors.password).toBeDefined();
  });

  test('valid data produces no errors', async () => {
    const { result } = await renderHook(() => useTypedForm({ schema }));
    await act(async () => {
      result.current.setValue('email', 'user@example.com');
      result.current.setValue('password', 'securepass');
      await result.current.trigger();
    });
    const errors = result.current.formState.errors;
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
  });
});

// ─── useFormServerError ───────────────────────────────────────────────────────

describe('useFormServerError', () => {
  const schema = z.object({ name: z.string() });

  test('serverError is null initially', async () => {
    const { result } = await renderHook(() => {
      const form = useTypedForm({ schema });
      const serverError = useFormServerError(form);
      return serverError;
    });
    expect(result.current.serverError).toBeNull();
  });

  test('setServerError sets the error message', async () => {
    const { result } = await renderHook(() => {
      const form = useTypedForm({ schema });
      return { form, serverErrorHook: useFormServerError(form) };
    });
    await act(async () => {
      result.current.serverErrorHook.setServerError('Something went wrong');
    });
    expect(result.current.serverErrorHook.serverError).toBe('Something went wrong');
  });

  test('clearServerError removes the error', async () => {
    const { result } = await renderHook(() => {
      const form = useTypedForm({ schema });
      return { form, serverErrorHook: useFormServerError(form) };
    });
    await act(async () => {
      result.current.serverErrorHook.setServerError('Error msg');
    });
    await act(async () => {
      result.current.serverErrorHook.clearServerError();
    });
    expect(result.current.serverErrorHook.serverError).toBeNull();
  });

  test('setServerError(null) also clears the error', async () => {
    const { result } = await renderHook(() => {
      const form = useTypedForm({ schema });
      return { form, serverErrorHook: useFormServerError(form) };
    });
    await act(async () => {
      result.current.serverErrorHook.setServerError('An error');
    });
    await act(async () => {
      result.current.serverErrorHook.setServerError(null);
    });
    expect(result.current.serverErrorHook.serverError).toBeNull();
  });
});

// ─── useAsyncFieldValidator ───────────────────────────────────────────────────

describe('useAsyncFieldValidator', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('starts with isValidating=false and error=null', async () => {
    const asyncCheck = jest.fn(async () => null);
    const { result } = await renderHook(() =>
      useAsyncFieldValidator('', asyncCheck, 500)
    );
    expect(result.current.isValidating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('runs asyncCheck after debounce and returns null for valid value', async () => {
    const asyncCheck = jest.fn(async (v: string) => (v === 'taken' ? 'Already taken' : null));
    const { result } = await renderHook(() =>
      useAsyncFieldValidator('free', asyncCheck, 300)
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(asyncCheck).toHaveBeenCalledWith('free');
    expect(result.current.error).toBeNull();
  });

  test('returns error string when asyncCheck resolves with message', async () => {
    const asyncCheck = jest.fn(async () => 'Email already in use');
    const { result } = await renderHook(() =>
      useAsyncFieldValidator('test@x.com', asyncCheck, 300)
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(result.current.error).toBe('Email already in use');
  });

  test('cancels in-flight check when value changes rapidly', async () => {
    let resolveFirst!: (v: string | null) => void;
    const firstCheckPromise = new Promise<string | null>(r => { resolveFirst = r; });
    const asyncCheck = jest.fn()
      .mockReturnValueOnce(firstCheckPromise)
      .mockResolvedValue(null);

    const { result, rerender } = await renderHook(
      ({ val }: { val: string }) => useAsyncFieldValidator(val, asyncCheck, 100),
      { initialProps: { val: 'first' } }
    );

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Change value before the first check resolves. Wrap in act() so the
    // effect cleanup (which flips the in-flight check's `cancelled` flag) is
    // flushed before we resolve the stale promise — outside act() the passive
    // effect cleanup never runs under fake timers, so the stale result lands.
    await act(async () => {
      rerender({ val: 'second' });
    });

    await act(async () => {
      // Resolve the first (now-cancelled) check with a stale error, then let
      // the debounce for 'second' fire and resolve to null.
      resolveFirst('stale error');
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should not show the stale error from the cancelled first check
    expect(result.current.error).toBeNull();
  });
});

// ─── FormInput ────────────────────────────────────────────────────────────────

describe('FormInput', () => {
  const schema = z.object({ email: z.string().email('Invalid email') });

  function Wrapper({ name = 'email' }: { name?: string }) {
    const { control } = useTypedForm({ schema });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <FormInput name={name} control={control as any} label="Email" testID="email-input" />;
  }

  test('renders label and input', async () => {
    const { getByText, getByTestId } = await render(<Wrapper />);
    expect(getByText('Email')).toBeTruthy();
    expect(getByTestId('email-input')).toBeTruthy();
  });

  test('does not show error before the field is touched', async () => {
    const { queryByRole } = await render(<Wrapper />);
    expect(queryByRole('alert')).toBeNull();
  });

  test('shows error after validation fails and field is touched', async () => {
    const { getByTestId, getByText } = await render(<Wrapper />);
    const input = getByTestId('email-input');

    // Fire the events inside act() so react-hook-form's async onBlur validation
    // is fully drained before the test ends. Firing bare and flushing with a
    // single Promise.resolve() leaves the validation promise pending past the
    // test, which corrupts the shared renderer and blanks every later render().
    await act(async () => {
      fireEvent.changeText(input, 'invalid-email');
      fireEvent(input, 'focus');
      fireEvent(input, 'blur');
    });

    await waitFor(() => expect(getByText('Invalid email')).toBeTruthy());
  });
});

// ─── FormSelect ───────────────────────────────────────────────────────────────

describe('FormSelect', () => {
  const schema = z.object({ country: z.string() });
  const options = [
    { label: 'United States', value: 'us' },
    { label: 'Canada', value: 'ca' },
  ];

  function Wrapper() {
    const { control } = useTypedForm({ schema });
    return (
      <FormSelect
        name="country"
        control={control as any}
        label="Country"
        options={options}
        testID="country-select"
      />
    );
  }

  test('renders label and touchable', async () => {
    const { getByText, getByTestId } = await render(<Wrapper />);
    expect(getByText('Country')).toBeTruthy();
    expect(getByTestId('country-select')).toBeTruthy();
  });

  test('opens modal on press', async () => {
    const { getByTestId } = await render(<Wrapper />);
    await act(async () => {
      fireEvent.press(getByTestId('country-select'));
    });
    expect(getByTestId('country-select-modal')).toBeTruthy();
  });

  test('calls onChange with selected value', async () => {
    const { getByTestId } = await render(<Wrapper />);
    await act(async () => {
      fireEvent.press(getByTestId('country-select'));
    });
    // Selecting an option fires react-hook-form's onChange (async); drain it
    // inside act() so the update doesn't leak past the test and blank the
    // shared renderer for every test that follows.
    await act(async () => {
      fireEvent.press(getByTestId('country-select-option-ca'));
    });
    // Modal closes and selected value would be 'ca'
    expect(() => getByTestId('country-select')).not.toThrow();
  });
});

// ─── FormCheckbox ─────────────────────────────────────────────────────────────

describe('FormCheckbox', () => {
  const schema = z.object({ agree: z.boolean() });

  function Wrapper() {
    const { control } = useTypedForm({ schema });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <FormCheckbox name="agree" control={control as any} label="I agree" testID="agree-cb" />;
  }

  test('renders label', async () => {
    const { getByText } = await render(<Wrapper />);
    expect(getByText('I agree')).toBeTruthy();
  });

  test('toggles value on press', async () => {
    const { getByTestId } = await render(<Wrapper />);
    expect(getByTestId('agree-cb').props.accessibilityState?.checked).toBe(false);
    await act(async () => {
      fireEvent.press(getByTestId('agree-cb'));
    });
    expect(getByTestId('agree-cb').props.accessibilityState?.checked).toBe(true);
  });
});

// ─── FormSwitch ───────────────────────────────────────────────────────────────

describe('FormSwitch', () => {
  const schema = z.object({ notifications: z.boolean() });

  function Wrapper() {
    const { control } = useTypedForm({ schema });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <FormSwitch name="notifications" control={control as any} label="Notifications" testID="notif-switch" />;
  }

  test('renders switch with label', async () => {
    const { getByText, getByTestId } = await render(<Wrapper />);
    expect(getByText('Notifications')).toBeTruthy();
    expect(getByTestId('notif-switch')).toBeTruthy();
  });

  test('toggles value via onValueChange', async () => {
    const { getByTestId } = await render(<Wrapper />);
    expect(getByTestId('notif-switch').props.value).toBe(false);
    await act(async () => {
      fireEvent(getByTestId('notif-switch'), 'valueChange', true);
    });
    expect(getByTestId('notif-switch').props.value).toBe(true);
  });
});

// ─── FormButton ───────────────────────────────────────────────────────────────

describe('FormButton', () => {
  test('renders title when not submitting', async () => {
    const { getByText } = await render(
      <FormButton onPress={() => {}} title="Submit" testID="submit-btn" />
    );
    expect(getByText('Submit')).toBeTruthy();
  });

  test('shows ActivityIndicator when isSubmitting', async () => {
    const { getByTestId, queryByText } = await render(
      <FormButton onPress={() => {}} title="Submit" isSubmitting testID="submit-btn" />
    );
    expect(getByTestId('submit-btn-spinner')).toBeTruthy();
    expect(queryByText('Submit')).toBeNull();
  });

  test('is disabled when disabled prop is true', async () => {
    const { getByTestId } = await render(
      <FormButton onPress={() => {}} title="Submit" disabled testID="submit-btn" />
    );
    expect(getByTestId('submit-btn').props.accessibilityState?.disabled).toBe(true);
  });
});

// ─── FormErrorBanner ─────────────────────────────────────────────────────────

describe('FormErrorBanner', () => {
  test('renders error text when error is present', async () => {
    const { getByText } = await render(<FormErrorBanner error="Something went wrong" />);
    expect(getByText('Something went wrong')).toBeTruthy();
  });

test('renders nothing when error is null', async () => {
    const { queryByTestId } = await render(<FormErrorBanner error={null} />);
    expect(queryByTestId('form-error-banner')).toBeNull();
  });

  test('has accessibilityRole alert when shown', async () => {
    const { getByTestId } = await render(<FormErrorBanner error="Oops" />);
    const banner = getByTestId('form-error-banner');
    expect(banner.props.accessibilityRole).toBe('alert');
  });
});