/**
 * GAS Template, FormWizard
 *
 * Multi-step form wizard with per-step validation, progress UI, and a11y
 * announcements. Supports both controlled (external form prop) and
 * uncontrolled (internal useTypedForm) modes.
 */

import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text } from 'react-native';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { z } from 'zod/v4';
import { useTypedForm } from '@/lib/forms';
import { FormButton } from './FormButton';
import { useThemeColors } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormWizardStep<TData extends FieldValues = any> = {
  id: string;
  title: string;
  fields: (keyof TData)[];
  render: (form: UseFormReturn<TData>, stepIndex: number) => ReactNode;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormWizardProps<TData extends FieldValues = any> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodType<TData, any>;
  steps: FormWizardStep<TData>[];
  defaultValues?: Partial<TData>;
  onComplete: (data: TData) => void | Promise<void>;
  form?: UseFormReturn<TData>;
  renderHeader?: (current: number, total: number) => ReactNode;
  nextLabel?: string;
  backLabel?: string;
  finishLabel?: string;
  testID?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * FormWizardCore, pure presentational component. Receives a pre-built `form`
 * instance so it never calls hooks conditionally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormWizardCore<TData extends FieldValues = any>(
  props: Omit<FormWizardProps<TData>, 'form' | 'schema' | 'defaultValues'> & {
    form: UseFormReturn<TData>;
  }
): React.JSX.Element | null {
  const {
    steps,
    onComplete,
    form,
    renderHeader,
    nextLabel = 'Next',
    backLabel = 'Back',
    finishLabel = 'Finish',
    testID,
  } = props;

const { colors } = useThemeColors();
  const [step, setStep] = useState(0);

  // Guard after hooks to comply with Rules of Hooks (I5).
  // Render nothing when steps array is empty.
  const safeStep = steps.length > 0 ? Math.min(step, steps.length - 1) : 0;
  const currentStep = steps[safeStep];

  const isFirst = safeStep === 0;
  const isLast = steps.length > 0 && safeStep === steps.length - 1;

  const handleBack = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
  }, []);

  const handleNext = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = await (form as UseFormReturn<any>).trigger(currentStep.fields as string[]);
    if (valid) {
      setStep(s => Math.min(steps.length - 1, s + 1));
    }
  }, [form, currentStep, steps.length]);

  const handleFinish = useCallback(() => {
    form.handleSubmit(onComplete)();
  }, [form, onComplete]);

  const defaultHeader = useCallback((current: number, total: number) => {
    const progress = (current + 1) / total;
    return (
      <View testID={testID ? `${testID}-header` : 'wizard-header'}>
        <Text
          style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}
        >
          {`Step ${current + 1} of ${total}`}
        </Text>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.primary,
              width: `${Math.round(progress * 100)}%`,
            }}
            testID={testID ? `${testID}-progress` : 'wizard-progress'}
          />
        </View>
      </View>
    );
  }, [colors, testID]);

  // Empty steps: render nothing (guard after hooks per Rules of Hooks).
  if (!steps.length) return null;

  return (
    <View testID={testID}>
      {/* A11y live region for step announcements */}
      <Text
        accessibilityLiveRegion="polite"
        accessible
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
        testID={testID ? `${testID}-announcement` : 'wizard-announcement'}
      >
{`Step ${safeStep + 1} of ${steps.length}, ${currentStep.title}`}
      </Text>

      {/* Header */}
      {renderHeader ? renderHeader(safeStep, steps.length) : defaultHeader(safeStep, steps.length)}

      {/* Current step content */}
      <View testID={testID ? `${testID}-step-${safeStep}` : `wizard-step-${safeStep}`}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {currentStep.render(form as UseFormReturn<any>, safeStep)}
      </View>

      {/* Navigation buttons */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <FormButton
            title={backLabel}
            onPress={handleBack}
            disabled={isFirst}
            testID={testID ? `${testID}-back` : 'wizard-back'}
          />
        </View>
        <View style={{ flex: 1 }}>
          {isLast ? (
            <FormButton
              title={finishLabel}
              onPress={handleFinish}
              isSubmitting={form.formState.isSubmitting}
              testID={testID ? `${testID}-finish` : 'wizard-finish'}
            />
          ) : (
            <FormButton
              title={nextLabel}
              onPress={handleNext}
              testID={testID ? `${testID}-next` : 'wizard-next'}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/** Uncontrolled variant: owns its own useTypedForm instance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormWizardUncontrolled<TData extends FieldValues = any>(
  props: Omit<FormWizardProps<TData>, 'form'>
): React.JSX.Element {
  const { schema, defaultValues, ...rest } = props;
  const form = useTypedForm<TData>({ schema, defaultValues, mode: 'onBlur' });
  return <FormWizardCore {...rest} form={form} />;
}

/**
 * Public entry point. Routes to the controlled or uncontrolled variant based
 * on whether a `form` prop is supplied, keeping hooks-rules compliant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FormWizard<TData extends FieldValues = any>(
  props: FormWizardProps<TData>
): React.JSX.Element {
  if (props.form) {
    const { schema: _schema, defaultValues: _dv, form, ...rest } = props;
    return <FormWizardCore {...rest} form={form} />;
  }
  return <FormWizardUncontrolled {...props} />;
}
