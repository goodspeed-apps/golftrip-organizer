# Forms

GAS Template ships a typed form layer built on [react-hook-form](https://react-hook-form.com/) v7 and [zod](https://zod.dev/) v4.

## Library overview

**`lib/forms.ts`** exports three hooks:

- **`useTypedForm`** - typed `useForm` wrapper with a zod v4 resolver. Defaults to `mode: 'onBlur'` so errors appear after the user leaves a field.
- **`useFormServerError`** - reads and sets `root.serverError` on an RHF form; use in `catch` blocks to surface API-level failures.
- **`useAsyncFieldValidator`** - debounced async field validator; cancels in-flight checks when the value changes.

**`components/forms/`** exports six primitives - all are `Controller`-wrapped and theme-aware:

- **`FormInput`** - single-line text input with label, error-on-touch, and a11y props.
- **`FormTextarea`** - multiline text input (`numberOfLines={4}`).
- **`FormSelect`** - TouchableOpacity trigger + Modal + FlatList options list; works on native and web.
- **`FormCheckbox`** - boolean field with a filled-box visual.
- **`FormSwitch`** - React Native `Switch` wrapped in Controller.
- **`FormButton`** - submit button with `ActivityIndicator` while `isSubmitting`.
- **`FormErrorBanner`** - red alert banner for server-level errors.

---

## Example 1 - Signup form

```tsx
import { z } from 'zod/v4';
import { useTypedForm, useFormServerError } from '@/lib/forms';
import { FormInput, FormButton, FormErrorBanner } from '@/components/forms';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type SignupData = z.infer<typeof schema>;

export function SignupScreen() {
  const form = useTypedForm<SignupData>({ schema });
  const { serverError, setServerError, clearServerError } = useFormServerError(form);

  const onSubmit = form.handleSubmit(async (data) => {
    clearServerError();
    try {
      await api.signup(data);
    } catch (err) {
      setServerError('Sign-up failed. Please try again.');
    }
  });

  return (
    <View style={{ padding: 24 }}>
      <FormErrorBanner error={serverError} />
      <FormInput
        name="email"
        control={form.control}
        label="Email"
        keyboardType="email-address"
        autoComplete="email"
        rules={{ required: 'Email is required' }}
        testID="signup-email"
      />
      <FormInput
        name="password"
        control={form.control}
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        testID="signup-password"
      />
      <FormButton
        title="Create account"
        onPress={onSubmit}
        isSubmitting={form.formState.isSubmitting}
        testID="signup-submit"
      />
    </View>
  );
}
```

---

## Example 2 - Profile edit form

```tsx
import { z } from 'zod/v4';
import { useTypedForm, useFormServerError } from '@/lib/forms';
import {
  FormInput,
  FormTextarea,
  FormSelect,
  FormSwitch,
  FormButton,
  FormErrorBanner,
} from '@/components/forms';

const schema = z.object({
  displayName: z.string().min(1, 'Name is required').max(50),
  bio: z.string().max(200).optional(),
  country: z.string().min(1, 'Pick a country'),
  marketingEmails: z.boolean(),
});

type ProfileData = z.infer<typeof schema>;

const COUNTRIES = [
  { label: 'United States', value: 'us' },
  { label: 'Canada', value: 'ca' },
  { label: 'United Kingdom', value: 'gb' },
];

export function ProfileEditScreen({ initial }: { initial: Partial<ProfileData> }) {
  const form = useTypedForm<ProfileData>({
    schema,
    defaultValues: {
      displayName: initial.displayName ?? '',
      bio: initial.bio ?? '',
      country: initial.country ?? '',
      marketingEmails: initial.marketingEmails ?? false,
    },
  });
  const { serverError, setServerError, clearServerError } = useFormServerError(form);

  const onSubmit = form.handleSubmit(async (data) => {
    clearServerError();
    try {
      await api.updateProfile(data);
    } catch {
      setServerError('Could not save profile. Try again.');
    }
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <FormErrorBanner error={serverError} />
      <FormInput
        name="displayName"
        control={form.control}
        label="Display name"
        testID="profile-name"
      />
      <FormTextarea
        name="bio"
        control={form.control}
        label="Bio"
        placeholder="Tell us about yourself…"
        testID="profile-bio"
      />
      <FormSelect
        name="country"
        control={form.control}
        label="Country"
        options={COUNTRIES}
        testID="profile-country"
      />
      <FormSwitch
        name="marketingEmails"
        control={form.control}
        label="Receive marketing emails"
        testID="profile-marketing"
      />
      <FormButton
        title="Save changes"
        onPress={onSubmit}
        isSubmitting={form.formState.isSubmitting}
        testID="profile-save"
      />
    </ScrollView>
  );
}
```

---

## Example 3 - Multi-step wizard

Use `<FormWizard>` to declare each step declaratively. Navigation, per-step validation, and progress UI are handled automatically.

```tsx
import { z } from 'zod/v4';
import { FormWizard, FormInput, FormSelect, FormCheckbox } from '@/components/forms';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  plan: z.enum(['free', 'pro', 'team']),
  agreeToTerms: z.literal(true, { error: 'You must agree' }),
});

export function OnboardingWizard() {
  return (
    <FormWizard
      schema={schema}
      steps={[
        {
          id: 'account',
          title: 'Account',
          fields: ['email', 'password'],
          render: (form) => (
            <>
              <FormInput name="email" control={form.control} label="Email" />
              <FormInput name="password" control={form.control} label="Password" secureTextEntry />
            </>
          ),
        },
        {
          id: 'plan',
          title: 'Choose plan',
          fields: ['plan'],
          render: (form) => (
            <FormSelect
              name="plan"
              control={form.control}
              label="Plan"
              options={[
                { label: 'Free', value: 'free' },
                { label: 'Pro', value: 'pro' },
                { label: 'Team', value: 'team' },
              ]}
            />
          ),
        },
        {
          id: 'terms',
          title: 'Confirm',
          fields: ['agreeToTerms'],
          render: (form) => (
            <FormCheckbox name="agreeToTerms" control={form.control} label="I agree to the Terms" />
          ),
        },
      ]}
      onComplete={async (data) => { await api.completeOnboarding(data); }}
    />
  );
}
```

### Low-level pattern (for full control)

When you need custom navigation logic, server errors per-step, or layout that does not fit the `<FormWizard>` defaults, build the wizard manually with `useTypedForm` and `trigger`.

```tsx
import { z } from 'zod/v4';
import { useState } from 'react';
import { useTypedForm, useFormServerError } from '@/lib/forms';
import { FormInput, FormSelect, FormCheckbox, FormButton, FormErrorBanner } from '@/components/forms';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  plan: z.enum(['free', 'pro', 'team']),
  agreeToTerms: z.literal(true, { error: 'You must agree to the terms' }),
});

type WizardData = z.infer<typeof schema>;

const STEP_FIELDS: Array<(keyof WizardData)[]> = [
  ['email', 'password'],
  ['plan'],
  ['agreeToTerms'],
];

const PLANS = [
  { label: 'Free', value: 'free' },
  { label: 'Pro', value: 'pro' },
  { label: 'Team', value: 'team' },
];

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const form = useTypedForm<WizardData>({ schema, mode: 'onBlur' });
  const { serverError, setServerError, clearServerError } = useFormServerError(form);
  const isLast = step === STEP_FIELDS.length - 1;

  const goNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (valid) setStep(s => s + 1);
  };

  const onSubmit = form.handleSubmit(async (data) => {
    clearServerError();
    try {
      await api.completeOnboarding(data);
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  });

  return (
    <View style={{ padding: 24 }}>
      <FormErrorBanner error={serverError} />

      {step === 0 && (
        <>
          <FormInput name="email" control={form.control} label="Email" keyboardType="email-address" testID="wizard-email" />
          <FormInput name="password" control={form.control} label="Password" secureTextEntry testID="wizard-password" />
        </>
      )}

      {step === 1 && (
        <FormSelect name="plan" control={form.control} label="Choose a plan" options={PLANS} testID="wizard-plan" />
      )}

      {step === 2 && (
        <FormCheckbox name="agreeToTerms" control={form.control} label="I agree to the Terms of Service" testID="wizard-terms" />
      )}

      <FormButton
        title={isLast ? 'Finish' : 'Next'}
        onPress={isLast ? onSubmit : goNext}
        isSubmitting={form.formState.isSubmitting}
        testID="wizard-next"
      />
    </View>
  );
}
```

### Dynamic list of fields (`useFieldArray`)

When a step needs the user to add an arbitrary number of items (invite multiple friends, list dependents, add tags), pair `useTypedForm` with RHF's `useFieldArray`:

```tsx
import { useFieldArray } from 'react-hook-form';
import { z } from 'zod/v4';
import { useTypedForm } from '@/lib/forms';
import { FormInput, FormButton } from '@/components/forms';

const schema = z.object({
  invites: z.array(z.object({
    email: z.string().email('Enter a valid email'),
  })).min(1, 'Add at least one invite').max(10, 'Up to 10 invites'),
});

export function InviteList() {
  const form = useTypedForm({ schema, defaultValues: { invites: [{ email: '' }] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'invites' });

  return (
    <View>
      {fields.map((field, index) => (
        <View key={field.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <FormInput name={`invites.${index}.email`} control={form.control} label={`Invite ${index + 1}`} />
          </View>
          <FormButton title="Remove" onPress={() => remove(index)} disabled={fields.length === 1} />
        </View>
      ))}
      <FormButton title="Add another" onPress={() => append({ email: '' })} disabled={fields.length >= 10} />
      <FormButton title="Send invites" onPress={form.handleSubmit(async (data) => api.sendInvites(data.invites))} />
    </View>
  );
}
```

`field.id` is RHF-managed and stable across reorders, so use it (not `index`) as the React key. Schema-level constraints (`min`, `max`, per-item validation) flow through automatically.
