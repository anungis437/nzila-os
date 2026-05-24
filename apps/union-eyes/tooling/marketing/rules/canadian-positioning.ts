/**
 * Canadian positioning rule.
 *
 * Rewards Canadian-hosted, bilingual-first, sovereignty-conscious,
 * organizational-trust, democratic-infrastructure, governance-safe-operations.
 */

import { CANADIAN_POSITIONING_TERMS, countRewards } from "../config/required-vocabulary";
import type { PageContext, RuleFlag, RuleModule, RuleResult } from "./types";

const STRONG_CANADIAN_HINTS = ["canada", "canadian", "québec", "quebec", "bilingual"];

export const canadianPositioningRule: RuleModule = {
  name: "canadian-positioning",
  evaluate(content: string, _ctx: PageContext): RuleResult {
    const lower = content.toLowerCase();
    const { matched, score: rewardScore } = countRewards(content, CANADIAN_POSITIONING_TERMS);
    const generalCanadianHits = STRONG_CANADIAN_HINTS.filter((h) => lower.includes(h));

    const flags: RuleFlag[] = [];
    let status: RuleResult["status"] = "pass";
    let score = 70 + rewardScore * 5 + generalCanadianHits.length * 3;
    score = Math.min(100, score);

    if (matched.length === 0 && generalCanadianHits.length === 0 && content.length > 800) {
      status = "warn";
      score = Math.min(score, 55);
      flags.push({
        message: "No Canadian-positioning vocabulary detected on a substantive public page.",
        suggestion: "Where appropriate, surface Canadian-hosted / bilingual-first / sovereignty-conscious framing.",
      });
    }

    return {
      rule: this.name,
      status,
      score,
      flags,
      detail: { matched: matched.map((m) => m.term), generalCanadianHits },
    };
  },
};
