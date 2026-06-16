// HTML entity escape. Coerces undefined/null/numbers to safe strings.
export function escape(s: unknown): string {
  if (s === null || s === undefined) return '';
  const str = String(s);
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
