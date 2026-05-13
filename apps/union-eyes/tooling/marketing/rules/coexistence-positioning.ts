/**
 * Coexistence positioning rule.
 *
 * Rewards overlay/coexistence/non-disruptive language. Flags pages that lack
 * any coexistence framing.
 */

import { COEXISTENCE_TERMS, countRewards } from "../config/required-vocabulary";
import type { PageContext, RuleFlag, RuleModule, RuleResult } from "./types";

const REPLACEMENT_HINTS = [
  "rip and replace",
  "replace your systems",
  "fully replace",
  "all-in-one",
  "single source of truth",
];

export const coexistencePositioningRule: RuleModule = {
  name: "coexistence-positioning",
  evaluate(content: string, _ctx: PageContext): RuleResult {
    const { matched, score: rawScore } = countRewards(content, COEXISTENCE_TERMS);
    const lower = content.toLowerCase();
    const replacementHits = REPLACEMENT_HINTS.filter((h) => lower.includes(h));

    const flags: RuleFlag[] = [];
    let status: RuleResult["status"] = "pass";
    let score = Math.min(100, 50 + rawScore * 10);

    if (matched.length === 0 && content.length > 600) {
      status = "warn";
      score = Math.min(score, 55);
      flags.push({
        message: "No coexistence / overlay framing detected.",
        suggestion: "Use phrases like 'continuity layer', 'overlay infrastructure', or 'alongside existing systems'.",
      });
    }
    for (const hit of replacementHits) {
      status = "fail";
      score = Math.min(score, 25);
      flags.push({
        message: `Replacement-frame term detected: "${hit}".`,
        suggestion: "Reframe as overlay / continuity layer.",
      });
    }

    return {
      rule: this.name,
      status,
      score,
      flags,
      detail: { matched: matched.map((m) => m.term) },
    };
  },
};
