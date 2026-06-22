import { escape } from '../../_shared/escape.ts';

// Welcome email. Vars: { displayName: string, appName: string }
export const welcome = {
  subject: (vars: { displayName: string; appName: string }) =>
    `Welcome to ${vars.appName}`,
  html: (vars: { displayName: string; appName: string }) => `
    <p>Hi ${escape(vars.displayName)},</p>
    <p>Thanks for signing up for ${escape(vars.appName)}. You're all set.</p>
  `,
  text: (vars: { displayName: string; appName: string }) =>
    `Hi ${vars.displayName},\n\nThanks for signing up for ${vars.appName}. You're all set.\n`,
};
