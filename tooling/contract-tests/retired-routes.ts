/**
 * A retired route performs no operation: it answers 501 and touches no data. The contract tests that look for an
 * authorization token in a route's own text accept such a route only through this recogniser, which requires that the
 * route is built from a retired helper and carries nothing effectful. ue-retired-routes.test.ts proves the helpers
 * themselves are inert, so the exemption cannot be reached by a route that does anything.
 */
const RETIRED_CALL = /\bretired(?:Handler|FinancialRoute)\s*\(/;
const EFFECTFUL = /@\/db|from ['"]drizzle-orm|\bfetch\s*\(|persistAtomicAudit|performAuditedOperation|\.(?:insert|update|delete)\s*\(|\bdb\./;

export function isRetiredNoOpRoute(content: string): boolean {
  return RETIRED_CALL.test(content) && !EFFECTFUL.test(content);
}
