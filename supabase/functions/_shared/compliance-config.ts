export interface ComplianceConfig {
  accountDeletionGraceDays: number;
  allowImmediateDeletion: boolean;
}

const DEFAULT_GRACE_DAYS = 30;
const DEFAULT_ALLOW_IMMEDIATE = true;

export function getComplianceConfig(): ComplianceConfig {
  const grace = Number(Deno.env.get('ACCOUNT_DELETION_GRACE_DAYS'));
  const immediateRaw = Deno.env.get('ALLOW_IMMEDIATE_DELETION');
  return {
    accountDeletionGraceDays: Number.isFinite(grace) && grace > 0 ? grace : DEFAULT_GRACE_DAYS,
    allowImmediateDeletion: immediateRaw === undefined ? DEFAULT_ALLOW_IMMEDIATE : immediateRaw !== 'false',
  };
}