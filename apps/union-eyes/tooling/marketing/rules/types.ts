/**
 * Shared types for narrative-CI rule modules.
 */

export interface PageContext {
  /** Workspace-relative path. */
  path: string;
  /** True if surface is publicly reachable (marketing tree, public messages). */
  isPublicSurface: boolean;
  /** Locale, when applicable. */
  locale?: string;
  /** Free-form short label for reports. */
  label: string;
}

export type RuleStatus = "pass" | "warn" | "fail";

export interface RuleFlag {
  message: string;
  line?: number;
  excerpt?: string;
  suggestion?: string;
}

export interface RuleResult {
  rule: string;
  status: RuleStatus;
  /** 0..100 numeric score for aggregation, where higher is better. */
  score: number;
  flags: RuleFlag[];
  /** Optional structured detail to surface in reports. */
  detail?: Record<string, unknown>;
}

export interface RuleModule {
  name: string;
  evaluate(content: string, ctx: PageContext): RuleResult;
}
