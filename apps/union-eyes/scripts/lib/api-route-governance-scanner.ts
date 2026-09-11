/**
 * scripts/lib/api-route-governance-scanner.ts
 *
 * PR #752 round 19: per-EXPORT (not per-FILE) API route governance scanner.
 *
 * scripts/validate-api-governance.ts classifies an entire route.ts file as
 * "governed" the moment ANY approved wrapper string (e.g. `crudRoutes(`)
 * appears anywhere in the file — even if a DIFFERENT exported HTTP method in
 * that same file is a completely raw, wrapper-less handler. This is exactly
 * how app/api/pilot/apply/route.ts's GET (crudRoutes-wrapped) hid its
 * sibling POST (a bare `export async function POST(...)`, no auth reference
 * anywhere in its own body) from the whole-file scan for multiple rounds.
 *
 * This scanner instead evaluates each exported HTTP method independently:
 * it isolates the source text belonging to that export (from its own
 * `export` keyword to the next top-level `export` keyword, or EOF) and
 * checks THAT SPAN ALONE for a recognized auth-establishing reference.
 *
 * This is intentionally a text-span heuristic, not a full TypeScript AST
 * analysis — it tolerates auth checks appearing a few lines into a handler
 * body (e.g. `async (req) => { const user = await getCurrentUser(); ... }`)
 * while still catching a genuinely bare handler with zero auth reference.
 *
 * PR #752 round 20 correction: `rateLimit(`/`verifyTurnstileToken(` were
 * REMOVED from AUTH_ESTABLISHING_IDENTIFIERS. Rate limiting and anti-bot
 * challenges are abuse controls, not authentication or authorization — a
 * route calling ONLY `rateLimit(req)` before an unguarded sensitive
 * operation must still be classified UNGOVERNED. Whether a route is
 * INTENTIONALLY public is now decided EXCLUSIVELY by the explicit
 * path+method `PublicExportAllowlistEntry` allowlist (see
 * `isAllowlistedPublicExport` below), never by the presence of an abuse-
 * control call. `ABUSE_CONTROL_IDENTIFIERS` exists for a SEPARATE assertion
 * ("every allowlisted public export also has a rate-limit/schema/Turnstile
 * control"), not as an alternate route to "governed".
 */

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Identifiers that establish (or delegate to something that establishes)
 * authentication/authorization for a route export. Intentionally broad —
 * this scanner's job is to catch a TRUE ABSENCE of any auth reference, not
 * to police which specific wrapper is used. Deliberately excludes rate-
 * limiting and anti-bot identifiers (see ABUSE_CONTROL_IDENTIFIERS below) —
 * neither authenticates nor authorizes a caller.
 */
export const AUTH_ESTABLISHING_IDENTIFIERS = [
  "withApi(",
  "withApiAuth(",
  "crudRoutes(",
  "withOrganizationAuth(",
  "createCronHandler(",
  "cognitionRoute(",
  "withRoleAuth(",
  "withMinRole(",
  "withAdminAuth(",
  "withSystemAdminAuth(",
  "hasMinRole(",
  "hasRole(",
  "getCurrentUser(",
  "requireApiAuth(",
  "withPilotOwnership(",
  "verifyCronAuth(",
  "verifyStripeSignature(",
  "verifyWebhookSignature(",
] as const;

/**
 * Abuse-control identifiers: rate limiting and anti-bot challenges. These
 * are NEVER sufficient on their own to classify an export as "governed" —
 * they bound unauthenticated abuse, they do not authenticate or authorize.
 * Used for a separate, additive assertion on allowlisted-public exports
 * only (an intentionally public route SHOULD also have one of these).
 */
export const ABUSE_CONTROL_IDENTIFIERS = [
  "rateLimit(",
  "checkRateLimit(",
  "verifyTurnstileToken(",
] as const;

export interface RouteExportGovernance {
  method: HttpMethod;
  /** True if an auth-establishing identifier appears within this export's own span. */
  governed: boolean;
  /** The raw text span analyzed (for debugging/assertions). */
  span: string;
}

/**
 * Find every top-level `export` keyword's start offset (column 0 of a line),
 * used to bound each export's own span.
 */
function findTopLevelExportOffsets(content: string): number[] {
  const offsets: number[] = [];
  const re = /^export\s/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    offsets.push(match.index);
  }
  return offsets;
}

/**
 * Resolve, for each declared HTTP method export, the source span from its
 * own `export` line to the next top-level `export` line (or EOF).
 *
 * Handles both direct exports (`export const POST = ...` /
 * `export async function POST(...)`) and re-exports
 * (`const { GET } = crudRoutes(...); export { GET };` — in that case the
 * span traced is the ENTIRE FILE UP TO the re-export statement, since the
 * factory call that actually defines the handler lives earlier in the file,
 * not within a bounded per-export region).
 */
export function scanRouteFileExports(content: string): RouteExportGovernance[] {
  const exportOffsets = findTopLevelExportOffsets(content);
  const results: RouteExportGovernance[] = [];

  for (const method of HTTP_METHODS) {
    const directExportPattern = new RegExp(`^export\\s+(?:const|async function)\\s+${method}\\b`, "m");
    const directMatch = directExportPattern.exec(content);

    const reExportPattern = new RegExp(`^export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`, "m");
    const reExportMatch = reExportPattern.exec(content);

    if (!directMatch && !reExportMatch) continue;

    let span: string;
    if (directMatch) {
      const start = directMatch.index;
      const nextOffset = exportOffsets.find((o) => o > start);
      span = content.slice(start, nextOffset ?? content.length);
    } else {
      // Re-export form: the defining factory call lives earlier in the
      // file (e.g. `const { GET } = crudRoutes(...)`) — the whole file up
      // to (and including) the re-export statement is the relevant span.
      span = content.slice(0, (reExportMatch as RegExpExecArray).index + (reExportMatch as RegExpExecArray)[0].length);
    }

    const governed = AUTH_ESTABLISHING_IDENTIFIERS.some((id) => span.includes(id));
    results.push({ method, governed, span });
  }

  return results;
}

/** Path patterns that are intentionally, explicitly public for a given method. */
export interface PublicExportAllowlistEntry {
  routePath: string;
  method: HttpMethod;
}

export function isAllowlistedPublicExport(
  routePath: string,
  method: HttpMethod,
  allowlist: readonly PublicExportAllowlistEntry[],
): boolean {
  return allowlist.some((entry) => entry.routePath === routePath && entry.method === method);
}

/**
 * True if the given export's span references a rate-limit or anti-bot
 * identifier. Intended for a SEPARATE assertion on allowlisted-public
 * exports only ("this public route also has an abuse control") — never as
 * an alternate path to "governed" (see ABUSE_CONTROL_IDENTIFIERS's own doc
 * comment for why).
 */
export function hasAbuseControl(span: string): boolean {
  return ABUSE_CONTROL_IDENTIFIERS.some((id) => span.includes(id));
}
