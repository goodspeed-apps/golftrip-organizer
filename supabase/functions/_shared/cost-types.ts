// Shared types for the cost-tracking system. Mirrors the SQL CHECK
// constraints on cost_budgets.enforcement and cost_budgets.period.

export type EnforcementMode = 'throttle' | 'block' | 'alert_only';

export type CostPeriod = 'hour' | 'day' | 'month';
