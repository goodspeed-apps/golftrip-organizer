/**
 * Tests for lib/module-providers — pluggable provider registry.
 *
 * Verifies that:
 * (a) An empty registry is an identity: ModuleProviders renders children unchanged.
 * (b) A registered provider wraps children when enabledWhen returns true.
 * (c) Duplicate-key registrations are silently ignored.
 * (d) A provider whose enabledWhen returns false is not mounted.
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// Mock gas.config before importing module-providers so the module receives our
// controlled config object.
jest.mock('../../gas.config', () => ({
  gasConfig: {
    features: {
      helpSystem: false,
      inAppPurchases: { enabled: false },
      showBuiltWithBadge: false,
    },
  },
}));

// Import AFTER mock is in place.
import {
  moduleProviders,
  registerModuleProvider,
  ModuleProviders,
} from '../../lib/module-providers';

function clearRegistry() {
  moduleProviders.splice(0, moduleProviders.length);
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  clearRegistry();
});

// Sentinel host component so the renderer can find it in the tree by type.
function Sentinel({ label }: { label: string }) {
  return React.createElement('sentinel', { label });
}

// ─── (a) Identity with empty registry ─────────────────────────────────────────

describe('ModuleProviders — empty registry', () => {
  test('renders children unchanged when no providers are registered', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        React.createElement(ModuleProviders, null, React.createElement(Sentinel, { label: 'hi' })),
      );
    });
    const sentinel = tree!.root.findByType(Sentinel);
    expect(sentinel).toBeTruthy();
    expect(sentinel.props.label).toBe('hi');
  });

  test('renders children unchanged when all providers are disabled', () => {
    function WrapperProvider({ children }: { children: React.ReactNode }) {
      return React.createElement('disabledwrapper', null, children);
    }
    registerModuleProvider({
      key: 'disabled-provider',
      order: 1,
      Provider: WrapperProvider,
      enabledWhen: () => false,
    });

    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        React.createElement(ModuleProviders, null, React.createElement(Sentinel, { label: 'hi' })),
      );
    });
    expect(tree!.root.findByType(Sentinel)).toBeTruthy();
    expect(() => tree!.root.findByType(WrapperProvider)).toThrow();
  });
});

// ─── (b) Registered provider wraps children ───────────────────────────────────

describe('ModuleProviders — with registered provider', () => {
  test('provider is present in the rendered output when enabledWhen returns true', () => {
    function TestProvider({ children }: { children: React.ReactNode }) {
      return React.createElement('testprovider', null, children);
    }
    registerModuleProvider({ key: 'test-provider', order: 1, Provider: TestProvider, enabledWhen: () => true });

    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        React.createElement(ModuleProviders, null, React.createElement(Sentinel, { label: 'inner-child' })),
      );
    });
    const provider = tree!.root.findByType(TestProvider);
    expect(provider).toBeTruthy();
    expect(provider.findByType(Sentinel)).toBeTruthy();
  });

  test('disabled provider is absent from the tree', () => {
    function OffProvider({ children }: { children: React.ReactNode }) {
      return React.createElement('offprovider', null, children);
    }
    registerModuleProvider({ key: 'off-provider', order: 1, Provider: OffProvider, enabledWhen: () => false });

    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        React.createElement(ModuleProviders, null, React.createElement(Sentinel, { label: 'inner-child' })),
      );
    });
    expect(tree!.root.findByType(Sentinel)).toBeTruthy();
    expect(() => tree!.root.findByType(OffProvider)).toThrow();
  });
});

// ─── (c) Duplicate-key guard ──────────────────────────────────────────────────

describe('registerModuleProvider — duplicate key guard', () => {
  test('ignores a second registration with the same key', () => {
    function ProviderA({ children }: { children: React.ReactNode }) {
      return React.createElement('provider-a', null, children);
    }
    function ProviderB({ children }: { children: React.ReactNode }) {
      return React.createElement('provider-b', null, children);
    }
    registerModuleProvider({ key: 'dup', order: 1, Provider: ProviderA, enabledWhen: () => true });
    registerModuleProvider({ key: 'dup', order: 2, Provider: ProviderB, enabledWhen: () => true });

    expect(moduleProviders).toHaveLength(1);
    expect(moduleProviders[0].Provider).toBe(ProviderA);
  });
});
