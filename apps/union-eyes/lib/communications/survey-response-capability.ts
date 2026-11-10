/**
 * Anonymous survey-response capability tokens.
 *
 * DEF-0B5-SURVEY-RESPONSES-IDENTIFIED-OR-ANONYMOUS-RESPONSE-MUTATION-AUTHORITY.
 *
 * An anonymous survey response (survey_responses.userId NULL, see app/api/communications/surveys/[surveyId]/responses/route.ts)
 * has no owning identity by design — that is the point of an anonymous survey. But a bare response id is not
 * sufficient authority to act on it: any org member who knew or enumerated the id could otherwise submit, change,
 * or complete someone else's anonymous answers. This module issues a high-entropy capability token exactly once,
 * at response creation, and verifies a presented token against its stored hash before any later mutation of an
 * anonymous response. The raw token is never persisted — only its hash — so a database read alone can never
 * reconstruct a token able to pass verification.
 *
 * An identified response (userId set) never has a token issued; ownership via userId is sufficient there, and
 * continues to be enforced separately by each route.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** The header a caller presents a response capability token through. */
export const RESPONSE_CAPABILITY_HEADER = 'x-survey-response-token';

/** Issues a new capability token for an anonymous response, and the hash to persist on its row. The `token` is
 * returned to the caller exactly once (the response-creation route's response body) and must never be stored. */
export function issueResponseCapability(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashResponseCapability(token) };
}

/** The stored form of a capability token. Exported so the creation route and this module always agree on it. */
export function hashResponseCapability(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time verification of a presented capability token against a response's stored hash. Refuses (returns
 * false) whenever there is nothing a caller could ever legitimately present: no token was presented, the response
 * has no stored hash at all (an identified response, which must be authorized by userId instead — this function is
 * not the right check for it — or a response seeded before this mechanism existed, which this run intentionally
 * leaves unauthorizable through these routes rather than inventing a weaker fallback), or the stored hash is not
 * valid hex.
 */
export function verifyResponseCapability(
  provided: string | null | undefined,
  storedHashHex: string | null | undefined,
): boolean {
  if (!provided || !storedHashHex) return false;
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHashHex, 'hex');
  } catch {
    return false;
  }
  if (stored.length === 0) return false;
  const candidate = createHash('sha256').update(provided).digest();
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
