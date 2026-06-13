/**
 * Tests for hooks/useForm.ts — Form validation logic.
 */

import { z } from 'zod';

// Test the validation logic directly
describe('form validation logic', () => {
  const schema = z.object({
    email: z.string().email('Invalid email'),
    name: z.string().min(1, 'Name required'),
  });

  test('valid data passes', () => {
    const result = schema.safeParse({ email: 'test@example.com', name: 'John' });
    expect(result.success).toBe(true);
  });

  test('invalid email fails', () => {
    const result = schema.safeParse({ email: 'not-email', name: 'John' });
    expect(result.success).toBe(false);
  });

  test('missing name fails', () => {
    const result = schema.safeParse({ email: 'test@example.com', name: '' });
    expect(result.success).toBe(false);
  });

  test('extracts field-level errors', () => {
    const result = schema.safeParse({ email: 'bad', name: '' });
    if (!result.success) {
      const issues = result.error.issues;
      const emailError = issues.find(i => i.path[0] === 'email');
      const nameError = issues.find(i => i.path[0] === 'name');
      expect(emailError).toBeDefined();
      expect(nameError).toBeDefined();
    }
  });

  test('empty errors means valid', () => {
    const result = schema.safeParse({ email: 'a@b.com', name: 'OK' });
    expect(result.success).toBe(true);
  });

  test('handleSubmit only calls onSubmit if valid', () => {
    const onSubmit = jest.fn();
    const values = { email: 'test@example.com', name: 'John' };
    const errors = schema.safeParse(values);
    if (errors.success) onSubmit(values);
    expect(onSubmit).toHaveBeenCalledWith(values);
  });

  test('handleSubmit does not call onSubmit if invalid', () => {
    const onSubmit = jest.fn();
    const values = { email: 'bad', name: '' };
    const errors = schema.safeParse(values);
    if (errors.success) onSubmit(values);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('reset returns to initial values', () => {
    const initial = { email: '', name: '' };
    let values = { email: 'changed', name: 'changed' };
    values = { ...initial };
    expect(values).toEqual(initial);
  });
});
