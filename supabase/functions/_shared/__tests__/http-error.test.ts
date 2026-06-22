import { HttpError } from '../http-error';

describe('HttpError', () => {
  it('carries status and message', () => {
    const e = new HttpError(400, 'bad input');
    expect(e.status).toBe(400);
    expect(e.message).toBe('bad input');
  });

  it('is instanceof HttpError', () => {
    const e = new HttpError(503, 'service unavailable');
    expect(e instanceof HttpError).toBe(true);
  });

  it('is instanceof Error', () => {
    const e = new HttpError(402, 'payment required');
    expect(e instanceof Error).toBe(true);
  });

  it('has name set to HttpError', () => {
    const e = new HttpError(404, 'not found');
    expect(e.name).toBe('HttpError');
  });

  it('preserves a stack trace', () => {
    const e = new HttpError(500, 'oops');
    expect(typeof e.stack).toBe('string');
  });

  it('supports common status codes used across edge functions', () => {
    expect(new HttpError(400, 'bad').status).toBe(400);
    expect(new HttpError(402, 'pay').status).toBe(402);
    expect(new HttpError(429, 'rate').status).toBe(429);
    expect(new HttpError(503, 'down').status).toBe(503);
  });
});