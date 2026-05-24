/**
 * Procedural neutrality rule.
 *
 * Flags ideological / activist / factional / persuasive-constitutional /
 * politically-emotional framing on public surfaces. PASS / FAIL.
 */

import type { PageContext, RuleFlag, RuleModule, RuleResult } from "./types";

interface Pattern {
  pattern: RegExp;
  label: string;
  suggestion?: string;
}

const PATTERNS: Pattern[] = [
  { pattern: /\bfight\s+(back|for|the)\b/i, label: "combative framing", suggestion: "Use procedural language." },
  { pattern: /\bstruggle\b/i, label: "activist framing" },
  { pattern: /\bcomrades?\b/i, label: "factional framing" },
  { pattern: /\bsolidarity forever\b/i, label: "movement slogan" },
  { pattern: /\bthe boss(es)?\b/i, label: "factional framing" },
  { pattern: /\bworkers? unite\b/i, label: "activist slogan" },
  { pattern: /\bclass struggle\b/i, label: "ideological framing" },
  { pattern: /\b(crush|defeat|destroy)\s+(employers?|management|capital)\b/i, label: "combative framing" },
  { pattern: /\b(reclaim|seize)\s+(power|control)\b/i, label: "factional framing" },
  { pattern: /\bmust\s+(rise|stand)\b/i, label: "rallying / persuasive" },
  { pattern: /\bawaken\b/i, label: "persuasive emotionality" },
];

export const proceduralNeutralityRule: RuleModule = {
  name: "procedural-neutrality",
  evaluate(content: string, ctx: PageContext): RuleResult {
    const flags: RuleFlag[] = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      for (const p of PATTERNS) {
        if (p.pattern.test(lines[i])) {
          flags.push({
            message: `Non-neutral framing detected (${p.label}).`,
            line: i + 1,
            excerpt: lines[i].trim().slice(0, 200),
            suggestion: p.suggestion ?? "Rephrase in procedural / organizational terms.",
          });
        }
      }
    }
    if (flags.length === 0) {
      return { rule: this.name, status: "pass", score: 100, flags };
    }
    const status: RuleResult["status"] = ctx.isPublicSurface ? "fail" : "warn";
    const score = Math.max(0, 100 - flags.length * 20);
    return { rule: this.name, status, score, flags };
  },
};
