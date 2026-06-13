import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { z } from 'zod';
import { Text, View } from 'react-native';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../context/ThemeContext', () => ({
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

import { FormWizard } from '../../../components/forms/FormWizard';
import { useTypedForm } from '../../../lib/forms';
import { renderHook } from '@testing-library/react-native';

// ─── Test schema & steps ──────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  plan: z.enum(['free', 'pro', 'team']),
});

type WizardData = z.infer<typeof schema>;

const steps = [
  {
    id: 'account',
    title: 'Account',
    fields: ['email', 'password'] as (keyof WizardData)[],
    render: () => <Text testID="step-0-content">Step 0</Text>,
  },
  {
    id: 'plan',
    title: 'Choose Plan',
    fields: ['plan'] as (keyof WizardData)[],
    render: () => <Text testID="step-1-content">Step 1</Text>,
  },
  {
    id: 'confirm',
    title: 'Confirm',
    fields: [] as (keyof WizardData)[],
    render: () => <Text testID="step-2-content">Step 2</Text>,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FormWizard', () => {
  const onComplete = jest.fn();

  beforeEach(() => {
    onComplete.mockClear();
  });

  test('renders the first step on mount', async () => {
    const { getByTestId, queryByTestId } = await render(
      <FormWizard schema={schema} steps={steps} onComplete={onComplete} testID="wiz" />
    );
    expect(getByTestId('step-0-content')).toBeTruthy();
    expect(queryByTestId('step-1-content')).toBeNull();
    expect(queryByTestId('step-2-content')).toBeNull();
  });

  test('"Back" button is disabled on step 0', async () => {
    const { getByTestId } = await render(
      <FormWizard schema={schema} steps={steps} onComplete={onComplete} testID="wiz" />
    );
    const back = getByTestId('wiz-back');
    expect(back.props.accessibilityState?.disabled).toBe(true);
  });

  test('"Next" advances when step validation passes', async () => {
    const { getByTestId, queryByTestId } = await render(
      <FormWizard
        schema={schema}
        steps={[
          {
            id: 'any',
            title: 'Any',
            fields: [] as (keyof WizardData)[],
            render: () => <Text testID="s0">S0</Text>,
          },
          {
            id: 'second',
            title: 'Second',
            fields: [] as (keyof WizardData)[],
            render: () => <Text testID="s1">S1</Text>,
          },
        ]}
        onComplete={onComplete}
        testID="wiz"
      />
    );
    expect(getByTestId('s0')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId('wiz-next'));
    });
    await waitFor(() => {
      expect(queryByTestId('s0')).toBeNull();
      expect(getByTestId('s1')).toBeTruthy();
    });
  });

  test('"Next" does NOT advance when step validation fails', async () => {
    const strictSchema = z.object({
      email: z.string().email('Enter a valid email'),
    });
    const strictSteps = [
      {
        id: 'step1',
        title: 'Email',
        fields: ['email'] as (keyof z.infer<typeof strictSchema>)[],
        render: () => <Text testID="strict-s0">S0</Text>,
      },
      {
        id: 'step2',
        title: 'Done',
        fields: [] as (keyof z.infer<typeof strictSchema>)[],
        render: () => <Text testID="strict-s1">S1</Text>,
      },
    ];
    const { getByTestId, queryByTestId } = await render(
      <FormWizard
        schema={strictSchema}
        steps={strictSteps}
        onComplete={onComplete}
        testID="wiz"
      />
    );
    // email is empty — validation should fail, stay on step 0
    await act(async () => {
      fireEvent.press(getByTestId('wiz-next'));
    });
    await waitFor(() => {
      expect(getByTestId('strict-s0')).toBeTruthy();
      expect(queryByTestId('strict-s1')).toBeNull();
    });
  });

  test('"Back" decrements step', async () => {
    const twoSteps = [
      {
        id: 'a',
        title: 'A',
        fields: [] as (keyof WizardData)[],
        render: () => <Text testID="two-s0">S0</Text>,
      },
      {
        id: 'b',
        title: 'B',
        fields: [] as (keyof WizardData)[],
        render: () => <Text testID="two-s1">S1</Text>,
      },
    ];
    const { getByTestId } = await render(
      <FormWizard schema={schema} steps={twoSteps} onComplete={onComplete} testID="wiz" />
    );
    // advance to step 1
    await act(async () => {
      fireEvent.press(getByTestId('wiz-next'));
    });
    await waitFor(() => expect(getByTestId('two-s1')).toBeTruthy());
    // go back
    await act(async () => {
      fireEvent.press(getByTestId('wiz-back'));
    });
    await waitFor(() => expect(getByTestId('two-s0')).toBeTruthy());
  });

  test('on last step "Finish" appears in place of "Next"', async () => {
    const oneStep = [
      {
        id: 'only',
        title: 'Only',
        fields: [] as (keyof WizardData)[],
        render: () => <Text testID="only-s0">S0</Text>,
      },
    ];
    const { getByTestId, queryByTestId } = await render(
      <FormWizard schema={schema} steps={oneStep} onComplete={onComplete} testID="wiz" />
    );
    expect(getByTestId('wiz-finish')).toBeTruthy();
    expect(queryByTestId('wiz-next')).toBeNull();
  });

  test('"Finish" calls onComplete with the full form data', async () => {
    const simpleSchema = z.object({ name: z.string().min(1) });
    const { result } = await renderHook(() =>
      useTypedForm({ schema: simpleSchema, defaultValues: { name: 'Alice' } })
    );
    const { getByTestId } = await render(
      <FormWizard
        schema={simpleSchema}
        steps={[
          {
            id: 'name',
            title: 'Name',
            fields: ['name'] as (keyof z.infer<typeof simpleSchema>)[],
            render: () => <Text testID="fin-s0">S0</Text>,
          },
        ]}
        form={result.current}
        onComplete={onComplete}
        testID="wiz"
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId('wiz-finish'));
    });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ name: 'Alice' }, undefined);
    });
  });

  test('step transition announces via accessibilityLiveRegion="polite"', async () => {
    const { getByTestId } = await render(
      <FormWizard schema={schema} steps={steps} onComplete={onComplete} testID="wiz" />
    );
    const announcement = getByTestId('wiz-announcement');
    expect(announcement.props.accessibilityLiveRegion).toBe('polite');
    expect(announcement.props.children).toContain('Step 1 of 3');
    expect(announcement.props.children).toContain('Account');
  });

  test('controlled mode: external form prop is respected', async () => {
    const simpleSchema = z.object({ name: z.string().min(1) });
    const { result } = await renderHook(() =>
      useTypedForm({ schema: simpleSchema, defaultValues: { name: 'Bob' } })
    );
    const { getByTestId } = await render(
      <FormWizard
        schema={simpleSchema}
        steps={[
          {
            id: 'name',
            title: 'Name',
            fields: ['name'] as (keyof z.infer<typeof simpleSchema>)[],
            render: (form) => (
              <Text testID="ctrl-name">{String(form.getValues('name'))}</Text>
            ),
          },
        ]}
        form={result.current}
        onComplete={onComplete}
        testID="wiz"
      />
    );
    expect(getByTestId('ctrl-name').props.children).toBe('Bob');
  });

  test('custom renderHeader overrides default header', async () => {
    const { getByTestId, queryByTestId } = await render(
      <FormWizard
        schema={schema}
        steps={steps}
        onComplete={onComplete}
        renderHeader={(current, total) => (
          <View testID="custom-header">
            <Text>{`Custom ${current + 1}/${total}`}</Text>
          </View>
        )}
        testID="wiz"
      />
    );
expect(getByTestId('custom-header')).toBeTruthy();
    // default header should not exist
    expect(queryByTestId('wiz-header')).toBeNull();
  });
});
