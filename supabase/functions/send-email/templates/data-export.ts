import { escape } from '../../_shared/escape.ts';

function safeUrl(u: string): string {
  if (!/^https?:\/\//i.test(u)) throw new Error('send_email: downloadUrl must use http or https');
  return u;
}

export const dataExport = {
  subject: (vars: { appName: string }) => `Your ${vars.appName} data export is ready`,
  html: (vars: { appName: string; downloadUrl: string; expiresAt: string }) => `
    <p>Your ${escape(vars.appName)} data export is ready.</p>
    <p><a href="${escape(safeUrl(vars.downloadUrl))}">Download your data</a></p>
    <p>This link expires on <strong>${escape(vars.expiresAt)}</strong>.</p>
    <p>The download is a gzipped JSON file containing all data we hold about your account.</p>
  `,
  text: (vars: { appName: string; downloadUrl: string; expiresAt: string }) =>
    `Your ${vars.appName} data export is ready.\n\nDownload: ${safeUrl(vars.downloadUrl)}\nExpires: ${vars.expiresAt}\n`,
};
