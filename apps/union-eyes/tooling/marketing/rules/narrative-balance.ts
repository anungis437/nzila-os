/**
 * Narrative balance rule.
 *
 * Targets ~30% governance, 30% continuity, 20% coordination, 20% trust.
 * Flags governance saturation when governance share > 40%.
 */

import { NARRATIVE_PILLARS, type Pillar } from "../config/required-vocabulary";
import type { PageContext, RuleFlag, RuleModule, RuleResult } from "./types";

const TARGETS: Record<Pillar, number> = {
  governance: 0.3,
  continuity: 0.3,
  coordination: 0.2,
  trust: 0.2,
};

const SATURATION_THRESHOLD = 0.4;

function countMatches(text: string, needles: readonly string[]): number {
  const lower = text.toLowerCase();
  let total = 0;
  for (const n of needles) {
    let idx = 0;
    while ((idx = lower.indexOf(n, idx)) !== -1) {
      total++;
      idx += n.length;
    }
  }
  return total;
}

export const narrativeBalanceRule: RuleModule = {
  name: "narrative-balance",
  evaluate(content: string, _ctx: PageContext): RuleResult {
    const counts: Record<Pillar, number> = {
      governance: countMatches(content, NARRATIVE_PILLARS.governance),
      continuity: countMatches(content, NARRATIVE_PILLARS.continuity),
      coordination: countMatches(content, NARRATIVE_PILLARS.coordination),
      trust: countMatches(content, NARRATIVE_PILLARS.trust),
    };
    const total = counts.governance + counts.continuity + counts.coordination + counts.trust;
    const flags: RuleFlag[] = [];
    let score = 100;

    if (total === 0) {
      return {
        rule: this.name,
        status: "warn",
        score: 50,
        flags: [{ message: "No narrative-pillar vocabulary detected." }],
        detail: { counts, total, shares: {} },
      };
    }

    const shares: Record<Pillar, number> = {
      governance: counts.governance / total,
      continuity: counts.continuity / total,
      coordination: counts.coordination / total,
      trust: counts.trust / total,
    };

    // Penalize deviation from target.
    let deviationPenalty = 0;
    for (const k of Object.keys(TARGETS) as Pillar[]) {
      deviationPenalty += Math.abs(shares[k] - TARGETS[k]) * 100;
    }
    score = Math.max(0, Math.round(100 - deviationPenalty));

    let status: RuleResult["status"] = "pass";
    if (shares.governance > SATURATION_THRESHOLD) {
      status = "warn";
      flags.push({
        message: `Governance saturation detected: ${(shares.governance * 100).toFixed(1)}% of pillar terms (target ${TARGETS.governance * 100}%, threshold ${SATURATION_THRESHOLD * 100}%).`,
        suggestion: "Rebalance toward continuity, coordination, and trust language.",
      });
    }
    if (shares.continuity < 0.15 && total >= 5) {
      status = status === "pass" ? "warn" : status;
      flags.push({
        message: `Continuity language under-represented: ${(shares.continuity * 100).toFixed(1)}% (target ${TARGETS.continuity * 100}%).`,
        suggestion: "Add institutional-continuity framing.",
      });
    }

    return {
      rule: this.name,
      status,
      score,
      flags,
      detail: { counts, total, shares },
    };
  },
};
