/**
 * GAS Template, Formatting Utilities
 *
 * Locale-aware number, currency, date, file size, and duration formatting.
 */

/** Format a number with locale grouping. Compact notation for large values. */
export function formatNumber(n: number, options?: { compact?: boolean }): string {
  if (options?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat('en').format(n);
}

/** Format a currency amount. */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
}

/** Format a date as relative ("2h ago") or absolute ("Mar 7"). */
export function formatDate(date: Date | string, format: 'relative' | 'absolute' = 'relative'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (format === 'absolute') {
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/** Format bytes as human-readable file size. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** Format milliseconds as duration ("2m 30s"). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Pluralize a word based on count. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
