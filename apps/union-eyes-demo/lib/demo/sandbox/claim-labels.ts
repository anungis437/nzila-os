/**
 * EC-007-05 — fail-closed claim labels for the demo sandbox.
 *
 * Partnership-agreed, practice-system-integrated, and PROVEN compensation
 * wording is rewritten to PROPOSED / DEMO. This does not authorize Fleet
 * external speech.
 */

export const SANDBOX_BANNER =
  'Synthetic sandbox — not a live WorkAid deployment — AUTH_START_WORKAID=NO';

export const ACCESS_NOT_RESPONSIBILITY =
  'View access is not a transfer of responsibility. Acknowledging this package records that the external specialist can see the granted matter. It does not assign the file, create a professional retain, or complete an external authorization.';

export const HANDOFF_ANTI_CLAIM =
  'These states record access acknowledgement only. They are not proof that responsibility transferred.';

/** Fixture used to prove a demo copy path rewrites overclaim text. Not rendered raw. */
export const OVERCLAIM_FIXTURE =
  'Partnership-agreed file, Clio-integrated workspace, PROVEN WSIB outcome.';

const REWRITE_RULES: ReadonlyArray<{ id: string; pattern: RegExp; replacement: string }> = [
  {
    id: 'partnership-agreed',
    pattern: /partnership[-\s]?agreed/gi,
    replacement: 'PROPOSED partnership language',
  },
  {
    id: 'clio-integrated',
    pattern: /clio[-\s]?integrated|integrated with clio/gi,
    replacement: 'DEMO external-system boundary',
  },
  {
    id: 'proven-wsib',
    pattern: /proven\s+wsib/gi,
    replacement: 'DEMO compensation narrative',
  },
];

export const BANNED_SURFACE_PATTERNS: readonly RegExp[] = [
  /partnership[-\s]?agreed/i,
  /clio[-\s]?integrated/i,
  /integrated with clio/i,
  /proven\s+wsib/i,
];

export interface FailClosedCopy {
  text: string;
  rewritten: boolean;
  blocked: string[];
}

export function failCloseDemoCopy(input: string): FailClosedCopy {
  let text = input;
  const blocked: string[] = [];

  for (const rule of REWRITE_RULES) {
    rule.pattern.lastIndex = 0;
    if (!rule.pattern.test(text)) {
      rule.pattern.lastIndex = 0;
      continue;
    }
    blocked.push(rule.id);
    rule.pattern.lastIndex = 0;
    text = text.replace(rule.pattern, rule.replacement);
    rule.pattern.lastIndex = 0;
  }

  return { text, rewritten: blocked.length > 0, blocked };
}

export function surfaceContainsOverclaim(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return BANNED_SURFACE_PATTERNS.some((pattern) => pattern.test(serialized));
}

export function sandboxBannerCopy(): string {
  return SANDBOX_BANNER;
}
