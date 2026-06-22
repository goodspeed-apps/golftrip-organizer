import { escape } from '../../_shared/escape.ts';

// Password reset. Vars: { resetUrl: string, appName: string }

function safeUrl(u: string): string {
  // Allow only http(s). Reject javascript:, data:, file:, etc.
  if (!/^https?:\/\//i.test(u)) {
    throw new Error('send_email: resetUrl must use http or https');
  }
  return u;
}

export const passwordReset = {
  subject: (vars: { appName: string }) => `Reset your ${vars.appName} password`,
  html: (vars: { resetUrl: string; appName: string }) => `
    <p>Someone (hopefully you) asked to reset the password on your ${escape(vars.appName)} account.</p>
    <p><a href="${escape(safeUrl(vars.resetUrl))}">Reset password</a></p>
    <p>If you didn't request this, ignore this email.</p>
  `,
  text: (vars: { resetUrl: string; appName: string }) =>
    `Reset your ${vars.appName} password: ${safeUrl(vars.resetUrl)}\n\nIf you didn't request this, ignore this email.\n`,
};
