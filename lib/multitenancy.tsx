import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { gasConfig } from '../gas.config';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
}

export interface OrgMember {
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

interface OrgState {
  current: Organization | null;
  available: Organization[];
  setCurrent: (orgId: string) => void;
  loading: boolean;
}

const OrgContext = createContext<OrgState | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OrgState>({ current: null, available: [], setCurrent: () => {}, loading: true });

  useEffect(() => {
    if (!gasConfig.multiTenancy.enabled) {
      setState(s => ({ ...s, loading: false }));
      return;
    }
(async () => {
      // Explicit column list mirrors the Organization interface, keep
      // them in sync. Avoids over-fetching (e.g. settings JSON) on the
      // org-switcher boot path.
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, slug, owner_user_id');
      const available = (orgs ?? []) as Organization[];
      setState({
        current: available[0] ?? null,
        available,
        setCurrent: (orgId: string) => {
          const next = available.find(o => o.id === orgId) ?? null;
          setState(s => ({ ...s, current: next }));
        },
        loading: false,
      });
    })();
  }, []);

  return <OrgContext.Provider value={state}>{children}</OrgContext.Provider>;
}

export function useCurrentOrg(): OrgState {
  const ctx = useContext(OrgContext);
  return ctx ?? { current: null, available: [], setCurrent: () => {}, loading: false };
}

/**
 * Apply the active org's `organization_id` filter to a Supabase query builder.
 * Typed against a minimal structural shape so callers don't need their own
 * `as any` at the call site.
 */
type AnyFilterBuilder = { eq: (col: string, value: string) => AnyFilterBuilder };

export function orgFilter<T extends AnyFilterBuilder>(query: T, currentOrgId: string | null): T {
  if (!gasConfig.multiTenancy.enabled || !currentOrgId) return query;
  return query.eq('organization_id', currentOrgId) as T;
}