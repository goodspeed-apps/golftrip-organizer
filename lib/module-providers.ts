/**
 * GAS Template, Pluggable Module Provider Registry
 *
 * Allows external modules to inject React context providers into the app's
 * provider tree without modifying _layout.tsx directly.
 *
 * Usage:
 *   import { registerModuleProvider } from '@/lib/module-providers';
 *
 *   registerModuleProvider({
 *     key: 'my-module',
 *     order: 10,
 *     Provider: MyProvider,
 *     enabledWhen: (cfg) => cfg.features.myFeature === true,
 *   });
 *
 * Then wrap your inner component with <ModuleProviders> in _layout.tsx.
 * With an empty (or all-disabled) registry ModuleProviders is a no-op.
 */

import React from 'react';
import { gasConfig } from '../gas.config';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleProviderEntry {
  /** Unique identifier, used to guard against duplicate registrations. */
  key: string;
  /** Ascending sort order. Lower = outermost provider in the tree. */
  order: number;
  /** The React provider component to mount. Must accept `children`. */
  Provider: React.ComponentType<{ children: React.ReactNode }>;
  /** Return true to activate this provider for the given config. */
  enabledWhen: (cfg: typeof gasConfig) => boolean;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

export const moduleProviders: ModuleProviderEntry[] = [];

/**
 * Register a module provider. Guards against duplicate keys, a second
 * registration with the same key is silently ignored.
 */
export function registerModuleProvider(entry: ModuleProviderEntry): void {
  const alreadyRegistered = moduleProviders.some((e) => e.key === entry.key);
  if (alreadyRegistered) return;
  moduleProviders.push(entry);
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Wraps `children` with every enabled, sorted module provider.
 *
 * - If the registry is empty, or all entries are disabled, returns `children`
 *   unchanged (identity, zero behavior change for the baseline template).
 * - Entries are sorted by `order` ascending so lower-order providers are
 *   outermost (i.e. wrap everything that follows).
 */
export function ModuleProviders({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const active = moduleProviders
    .filter((e) => e.enabledWhen(gasConfig))
    .sort((a, b) => a.order - b.order);

  if (active.length === 0) {
    return React.createElement(React.Fragment, null, children);
  }

  // Fold providers right-to-left: the last active entry is the innermost,
  // wrapping children directly; each earlier entry wraps the accumulator.
  return active.reduceRight<React.ReactElement>(
    (acc, entry) => React.createElement(entry.Provider, { key: entry.key, children: acc }),
    React.createElement(React.Fragment, null, children)
  );
}
