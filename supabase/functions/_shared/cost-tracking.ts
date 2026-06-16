import { serviceClient } from './edge-client.ts';
import type { CostPeriod, EnforcementMode } from './cost-types.ts';

export type { CostPeriod, EnforcementMode } from './cost-types.ts';

export interface ConsumeCostParams {
  scope: string;
  key: string;
  cost: number;
  period?: CostPeriod;
}

export interface ConsumeCostResult {
  allowed: boolean;
  remaining: number | null;
  resetAt: string | null;
  enforcement: EnforcementMode | null;
  throttled: boolean;
}

export async function consumeCost(p: ConsumeCostParams): Promise<ConsumeCostResult> {
  const client = serviceClient();
  const { data, error } = await client.rpc('consume_cost', {
    p_scope: p.scope,
    p_key: p.key,
    p_cost: p.cost,
    p_period: p.period ?? 'day',
  });
  if (error) throw error;
  const r = data as Record<string, unknown>;
  return {
    allowed: r.allowed === true,
    remaining: typeof r.remaining === 'number' ? r.remaining : null,
    resetAt: typeof r.reset_at === 'string' ? r.reset_at : null,
    enforcement: (r.enforcement as EnforcementMode | null) ?? null,
    throttled: r.throttled === true,
  };
}