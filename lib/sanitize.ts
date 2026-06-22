/**
 * GAS Template, Input Sanitization Utilities
 *
 * Sanitize user input for safe display and export.
 * Strips HTML tags and prevents formula injection in CSV exports.
 *
 * Usage:
 *   import { sanitizeUserInput, sanitizeCsvCell } from '../lib/sanitize';
 *
 * Dependencies: none (pure functions)
 */

/**
 * Strip HTML tags from user-generated text.
 * Prevents XSS when rendering user content in WebViews or exports.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a value for CSV export to prevent formula injection.
 *
 * Spreadsheet applications (Excel, Google Sheets) interpret cells starting
 * with =, +, -, @, \t, or \r as formulas. Prefixing with a single quote
 * forces text interpretation.
 */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Sanitize user input: trim, strip HTML, limit length.
 *
 * Use this for any user-provided text that will be stored or displayed:
 * profile names, comments, feedback, search queries, etc.
 *
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default 1000)
 */
export function sanitizeUserInput(input: string, maxLength = 1000): string {
  return stripHtml(input).trim().slice(0, maxLength);
}

/**
 * Sanitize text for push notification bodies.
 * Strips HTML and limits to 200 characters (APNs/FCM best practice).
 */
export function sanitizeNotificationText(input: string): string {
  return stripHtml(input).trim().slice(0, 200);
}
