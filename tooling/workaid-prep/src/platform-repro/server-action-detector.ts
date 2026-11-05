/**
 * Reference reproduction for WA-R3-001 / WA-R3-019 / WA-T081 / WA-T094.
 * Routed to the platform owner (Codex). NOT a patch to
 * tooling/contract-tests/server-action-org-scoping.test.ts.
 */

/** Verbatim logic of the detector at 38a824918, tooling/contract-tests/server-action-org-scoping.test.ts:72. */
export function legacyDetectorSaysServerAction(content: string): boolean {
  return content.includes("'use server'");
}

export interface DirectiveDetection {
  readonly isServerAction: boolean;
  readonly scope: 'FILE' | 'INLINE' | null;
  readonly quote: 'single' | 'double' | null;
}

const DIRECTIVE_LITERAL = /^(['"])([^'"\r\n]*)\1/;

/**
 * Detects a real `use server` directive with either quote style. File-level
 * directives live in the prologue (before any code, after comments and other
 * directives); function-level directives appear as the first statement of a body.
 */
export function detectUseServerDirective(source: string): DirectiveDetection {
  let rest = source.replace(/^\uFEFF/, '');
  for (;;) {
    rest = rest.replace(/^\s+/, '');
    if (rest.startsWith('//')) {
      rest = rest.replace(/^\/\/[^\n]*/, '');
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/');
      if (end === -1) break;
      rest = rest.slice(end + 2);
      continue;
    }
    const m = DIRECTIVE_LITERAL.exec(rest);
    if (!m) break;
    if (m[2] === 'use server') return { isServerAction: true, scope: 'FILE', quote: m[1] === "'" ? 'single' : 'double' };
    rest = rest.slice(m[0].length).replace(/^\s*;?/, '');
  }
  const inline = /\{\s*(?:\/\/[^\n]*\n\s*)*(['"])use server\1\s*;?/.exec(source);
  if (inline) return { isServerAction: true, scope: 'INLINE', quote: inline[1] === "'" ? 'single' : 'double' };
  return { isServerAction: false, scope: null, quote: null };
}

export interface ExceptionEntry {
  readonly path: string;
  readonly expires: string;
}

export function expiredExceptions(entries: readonly ExceptionEntry[], todayIso: string): ExceptionEntry[] {
  return entries.filter((e) => e.expires < todayIso);
}

export interface Violation {
  readonly path: string;
  readonly reason: 'MISSING_RESOLVE_ORG_CONTEXT' | 'EXCEPTION_EXPIRED';
}

export function orgScopingViolations(
  files: readonly { path: string; content: string }[],
  exceptions: readonly ExceptionEntry[],
  todayIso: string,
  detect: (content: string) => boolean,
): Violation[] {
  const out: Violation[] = [];
  for (const f of files) {
    if (!detect(f.content)) continue;
    if (f.content.includes('resolveOrgContext')) continue;
    const ex = exceptions.find((e) => e.path === f.path);
    if (!ex) out.push({ path: f.path, reason: 'MISSING_RESOLVE_ORG_CONTEXT' });
    else if (ex.expires < todayIso) out.push({ path: f.path, reason: 'EXCEPTION_EXPIRED' });
  }
  return out;
}
