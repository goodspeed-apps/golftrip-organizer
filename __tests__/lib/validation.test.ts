/**
 * Tests for lib/validation.ts
 */

import { emailSchema, passwordSchema, displayNameSchema, feedbackSchema, urlSchema, validate } from '../../lib/validation';

describe('emailSchema', () => {
  test('accepts valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });

  test('rejects invalid email', () => {
    expect(emailSchema.safeParse('not-email').success).toBe(false);
  });

  test('rejects empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  test('accepts valid password (8+ chars with uppercase)', () => {
    expect(passwordSchema.safeParse('Password123').success).toBe(true);
  });

  test('rejects short password', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
  });
});

describe('displayNameSchema', () => {
  test('accepts valid name', () => {
    expect(displayNameSchema.safeParse('John Doe').success).toBe(true);
  });

  test('rejects empty name', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false);
  });
});

describe('feedbackSchema', () => {
  test('accepts valid feedback string (10+ chars)', () => {
    const result = feedbackSchema.safeParse('This is great feedback!');
    expect(result.success).toBe(true);
  });

  test('rejects short feedback', () => {
    expect(feedbackSchema.safeParse('Short').success).toBe(false);
  });
});

describe('urlSchema', () => {
  test('accepts valid URL', () => {
    expect(urlSchema.safeParse('https://example.com').success).toBe(true);
  });

  test('rejects invalid URL', () => {
    expect(urlSchema.safeParse('not a url').success).toBe(false);
  });
});

describe('validate', () => {
  test('returns success for valid data', () => {
    const result = validate(emailSchema, 'a@b.com');
    expect(result.success).toBe(true);
  });

  test('returns error for invalid data', () => {
    const result = validate(emailSchema, 'bad');
    expect(result.success).toBe(false);
  });
});
