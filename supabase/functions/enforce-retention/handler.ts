import { enforceRetention } from '../_shared/retention.ts';

export async function handleEnforceRetention(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return enforceRetention();
}
