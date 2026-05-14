/**
 * Labour-safe AI rule.
 *
 * Required: human oversight, explainability, reviewability, governance-safe AI,
 * assistive intelligence, procedural transparency.
 * Forbidden: autonomous decisions, AI-led governance, predictive authority,
 * behavioural scoring, worker optimization, automated procedural enforcement.
 */

import {
  LABOUR_SAFE_AI_FORBIDDEN,
  LABOUR_SAFE_AI_REQUIRED,
  countRewards,
} from "../config/required-vocabulary";
import type { PageContext, RuleFlag, RuleModule, RuleResult } from "./types";

const AI_TRIGGERS = ["ai ", " ai", "machine learning", "model", "automation", "intelligent"];

export const labourSafeAiRule: RuleModule = {
  name: "labour-safe-ai",
  evaluate(content: string, _ctx: PageContext): RuleResult {
    const lower = content.toLowerCase();
    const mentionsAi = AI_TRIGGERS.some((t) => lower.includes(t));
    const flags: RuleFlag[] = [];

    // Forbidden phrases — always fail when present.
    for (const term of LABOUR_SAFE_AI_FORBIDDEN) {
      if (lower.includes(term.toLowerCase())) {
        flags.push({
          message: `Forbidden AI framing: "${term}".`,
          suggestion: "Reframe as assistive intelligence under human oversight.",
        });
      }
    }

    if (!mentionsAi && flags.length === 0) {
      return { rule: this.name, status: "pass", score: 100, flags };
    }

    const { matched, score: rewardScore } = countRewards(content, LABOUR_SAFE_AI_REQUIRED);

    let status: RuleResult["status"] = "pass";
    let score = 100;

    if (flags.length > 0) {
      status = "fail";
      score = 20;
    } else if (mentionsAi && matched.length === 0) {
      status = "fail";
      score = 40;
      flags.push({
        message: "AI is referenced without labour-safe framing (oversight / explainability / reviewability).",
        suggestion: "Add human-oversight, explainability, or governance-safe AI framing.",
      });
    } else {
      score = Math.min(100, 60 + rewardScore * 8);
    }

    return {
      rule: this.name,
      status,
      score,
      flags,
      detail: { mentionsAi, matchedRequired: matched.map((m) => m.term) },
    };
  },
};
