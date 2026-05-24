/**
 * prohibitedAiPatterns
 * ────────────────────
 * Machine-readable list of phrases that AI-generated narrative outputs MUST
 * NOT contain. Matched case-insensitive by `narrativeOutputValidator.ts`.
 *
 * Categories:
 *   - punitive_grading: institution-grading or risk-classification language
 *   - autonomous_judgment: language implying AI made an organizational decision
 *   - psychological_inference: claims about internal mental/emotional states
 *   - legal_conclusion: legal-style determinations
 *   - hr_diagnostic: HR-style personnel evaluation
 *   - disclosure_misrepresentation: marketing-style AI claims
 */

export type ProhibitedPatternCategory =
  | 'punitive_grading'
  | 'autonomous_judgment'
  | 'psychological_inference'
  | 'legal_conclusion'
  | 'hr_diagnostic'
  | 'disclosure_misrepresentation'
  | 'anti_surveillance';

export interface ProhibitedPattern {
  readonly category: ProhibitedPatternCategory;
  readonly pattern: RegExp;
  readonly description: string;
}

export const PROHIBITED_PATTERNS: ReadonlyArray<ProhibitedPattern> = [
  // ── punitive_grading ──────────────────────────────────────────────
  { category: 'punitive_grading', pattern: /\bhigh[-\s]?risk\s+organization\b/i, description: 'high-risk organization' },
  { category: 'punitive_grading', pattern: /\bpoor\s+leadership\b/i, description: 'poor leadership' },
  { category: 'punitive_grading', pattern: /\bfailing\s+governance\b/i, description: 'failing governance' },
  { category: 'punitive_grading', pattern: /\bunsafe\s+organization\b/i, description: 'unsafe organization' },
  { category: 'punitive_grading', pattern: /\bweak\s+institution\b/i, description: 'weak institution' },
  { category: 'punitive_grading', pattern: /\btoxic\s+culture\b/i, description: 'toxic culture' },
  { category: 'punitive_grading', pattern: /\binstitutional\s+grade\b/i, description: 'organizational grade' },
  { category: 'punitive_grading', pattern: /\bgovernance\s+grade\b/i, description: 'governance grade' },
  { category: 'punitive_grading', pattern: /\bleadership\s+rating\b/i, description: 'leadership rating' },

  // ── autonomous_judgment ───────────────────────────────────────────
  { category: 'autonomous_judgment', pattern: /\bAI\s+determined\b/i, description: 'AI determined' },
  { category: 'autonomous_judgment', pattern: /\bAI\s+predicts?\b/i, description: 'AI predicts' },
  { category: 'autonomous_judgment', pattern: /\bAI\s+identified\s+risks?\b/i, description: 'AI identified risk' },
  { category: 'autonomous_judgment', pattern: /\bAI\s+classified\b/i, description: 'AI classified' },
  { category: 'autonomous_judgment', pattern: /\bAI\s+evaluated\s+(?:your|this)\s+(?:organization|institution)\b/i, description: 'AI evaluated your organization' },

  // ── psychological_inference ───────────────────────────────────────
  { category: 'psychological_inference', pattern: /\bAI\s+detected\s+emotional\b/i, description: 'AI detected emotional' },
  { category: 'psychological_inference', pattern: /\bmembers\s+(?:feel|are\s+anxious|are\s+afraid)\b/i, description: 'psychological assumption about members' },
  { category: 'psychological_inference', pattern: /\bleadership\s+(?:feels|is\s+anxious|is\s+afraid)\b/i, description: 'psychological assumption about leadership' },
  { category: 'psychological_inference', pattern: /\bemotional\s+state\s+of\b/i, description: 'emotional state of' },
  { category: 'psychological_inference', pattern: /\bpsychological\s+profile\b/i, description: 'psychological profile' },

  // ── legal_conclusion ──────────────────────────────────────────────
  { category: 'legal_conclusion', pattern: /\bviolat(?:es|ion\s+of)\s+(?:the\s+)?(?:law|statute|act|regulation)\b/i, description: 'legal violation claim' },
  { category: 'legal_conclusion', pattern: /\bnon[-\s]?compliant\s+with\s+(?:the\s+)?(?:law|statute|act|regulation)\b/i, description: 'legal non-compliance claim' },
  { category: 'legal_conclusion', pattern: /\bin\s+breach\s+of\b/i, description: 'in breach of' },
  { category: 'legal_conclusion', pattern: /\billegal\s+(?:practice|conduct|action)\b/i, description: 'illegal conduct claim' },

  // ── hr_diagnostic ────────────────────────────────────────────────
  { category: 'hr_diagnostic', pattern: /\b(?:performance\s+improvement\s+plan|PIP)\b/i, description: 'HR PIP language' },
  { category: 'hr_diagnostic', pattern: /\bunderperforming\s+(?:staff|employees|members)\b/i, description: 'underperforming personnel' },
  { category: 'hr_diagnostic', pattern: /\bdisciplinary\s+action\b/i, description: 'disciplinary action' },

  // ── disclosure_misrepresentation ──────────────────────────────────
  { category: 'disclosure_misrepresentation', pattern: /\bpowered\s+by\s+AI\b/i, description: 'powered by AI' },
  { category: 'disclosure_misrepresentation', pattern: /\bAI[-\s]?generated\s+insights\b/i, description: 'AI-generated insights' },
  { category: 'disclosure_misrepresentation', pattern: /\bAI\s+(?:evaluated|assessed)\s+this\s+institution\b/i, description: 'AI evaluated this institution' },

  // ── anti_surveillance ─────────────────────────────────────────────
  { category: 'anti_surveillance', pattern: /\btyping\s+cadence\b/i, description: 'typing cadence reference' },
  { category: 'anti_surveillance', pattern: /\bsession\s+timing\b/i, description: 'session timing reference' },
  { category: 'anti_surveillance', pattern: /\bbehavioural\s+(?:metadata|signal|profile)\b/i, description: 'behavioural metadata reference' },
  { category: 'anti_surveillance', pattern: /\bbehavioral\s+(?:metadata|signal|profile)\b/i, description: 'behavioral metadata reference (US)' },
];

export interface ProhibitedPatternMatch {
  readonly category: ProhibitedPatternCategory;
  readonly description: string;
  readonly excerpt: string;
}

export function findProhibitedPatterns(
  text: string,
): ReadonlyArray<ProhibitedPatternMatch> {
  const out: ProhibitedPatternMatch[] = [];
  for (const p of PROHIBITED_PATTERNS) {
    const m = text.match(p.pattern);
    if (m) {
      out.push({
        category: p.category,
        description: p.description,
        excerpt: m[0],
      });
    }
  }
  return out;
}
