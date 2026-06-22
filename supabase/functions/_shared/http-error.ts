// supabase/functions/_shared/http-error.ts
// Typed error for edge functions: carries an HTTP status alongside the message
// so `errorMap` can narrow with `instanceof` instead of duck-typing `_status`.

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}
