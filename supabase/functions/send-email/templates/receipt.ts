import { escape } from '../../_shared/escape.ts';

// Receipt. Vars: { amount: string, currency: string, description: string, appName: string }
export const receipt = {
  subject: (vars: { appName: string }) => `Your ${vars.appName} receipt`,
  html: (vars: { amount: string; currency: string; description: string; appName: string }) => `
    <p>Thanks for your purchase on ${escape(vars.appName)}.</p>
    <p><strong>${escape(vars.description)}</strong></p>
    <p>${escape(vars.amount)} ${escape(vars.currency)}</p>
  `,
  text: (vars: { amount: string; currency: string; description: string; appName: string }) =>
    `Thanks for your purchase on ${vars.appName}.\n${vars.description}\n${vars.amount} ${vars.currency}\n`,
};
