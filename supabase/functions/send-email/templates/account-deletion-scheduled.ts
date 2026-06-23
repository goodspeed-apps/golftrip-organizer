import { escape } from '../../_shared/escape.ts';

export const accountDeletionScheduled = {
  subject: (vars: { appName: string }) => `Your ${vars.appName} account is scheduled for deletion`,
  html: (vars: { appName: string; scheduledFor: string }) => `
    <p>Your ${escape(vars.appName)} account is scheduled for deletion on <strong>${escape(vars.scheduledFor)}</strong>.</p>
    <p>If you didn't request this, log back in to cancel.</p>
    <p>After the scheduled date, your account and all associated data will be permanently removed.</p>
  `,
  text: (vars: { appName: string; scheduledFor: string }) =>
    `Your ${vars.appName} account is scheduled for deletion on ${vars.scheduledFor}.\n\nIf you didn't request this, log back in to cancel.\n`,
};
