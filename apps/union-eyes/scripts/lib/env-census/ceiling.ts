/**
 * Where the environment census stands, and the only ways it may move (UE-CONV-H-024). `pnpm census:env` (and scripts/__tests__/env-census.test.ts) fail when a kind of
 * finding is above its ceiling. Each ceiling can only fall: lower it in the change that fixes the findings, never raise it.
 *
 * Zero is the end for every kind that is code: a variable the code reads that nobody declared, a declaration nothing reads, a validated variable nothing uses, a claim
 * that a deployed runtime refuses a development hatch without a test that shows it, a key the deployment sets that the registry does not name.
 *
 * Four kinds are above zero by the owner's decision, not by neglect: the keys a deployed environment requires are provisioned after stabilization (the operator sets
 * them on the container, or the deploy workflow gains the line), and `.env.example` and the startup validator list the keys after the registry does. The provisioning
 * deferral is recorded by name below, so a key that a deployed environment newly requires cannot hide in the count.
 */
export interface EnvCensusReportLike {
  counts: Record<string, number>
  findings: ReadonlyArray<{ kind: string; name: string; detail: string; sites?: ReadonlyArray<{ file: string; line: number }> }>
}

export const CEILING: Record<string, number> = {
  UNDECLARED: 0,
  STALE: 0,
  CHECK_ONLY: 0,
  UNRESOLVED: 0,
  STALE_PATTERN: 0,
  PROVISIONED_UNKNOWN: 0,
  PROOF_MISSING: 0,
  INVALID_ENTRY: 0,
  DEAD_MODULE_GONE: 0,
  DEAD_MODULE_IMPORTED: 0,
  DEAD_READ: 0,
  // Deferred by the owner: the example file and the startup validator list the keys after the registry does; the deployment gains the keys after stabilization.
  EXAMPLE_DRIFT: 281,
  VALIDATOR_UNKNOWN: 109,
  UNVERIFIED_PROVISION: 12,
  UNPROVISIONED: 20,
}

/** The keys a deployed environment requires and the repository does not supply, deferred by name. A key that is not here fails the census. */
export const DEFERRED_PROVISIONING: readonly string[] = [
  'AUTH_AUDIENCE',
  'AUTH_ISSUER',
  'AZURE_AD_CLIENT_SECRET',
  'COMMUNICATIONS_TRACKING_SECRET',
  'DJANGO_SECRET_KEY',
  'EMAIL_SUPPRESSION_HASH_KEY',
  'EVIDENCE_SEAL_KEY',
  'NAR_SIGNING_KEY_ID',
  'NAR_SIGNING_SECRET',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'PUBLIC_INTAKE_AUDIT_KEY',
  'REQUEST_SIGNING_SECRET',
  'RESEND_WEBHOOK_SECRET',
  'STAGING_PROOFS_ENABLED',
  'STAGING_PROOF_SECRET',
  'TURNSTILE_SECRET_KEY',
  'UNION_EYES_ACCEPTANCE_AUTH_ENABLED',
  'UNION_EYES_ACCEPTANCE_AUTH_SECRET',
  'UNION_EYES_RUNTIME_ID',
  'WEBHOOK_DEFAULT_SECRET',
]

/** What is over: a line per kind above its ceiling with the first findings, and a line per required key that is not deferred by name. */
export function overCeiling(report: EnvCensusReportLike): string[] {
  const over: string[] = []
  for (const kind of Object.keys(CEILING)) {
    const count = report.counts[kind] ?? 0
    if (count <= CEILING[kind]) continue
    const lines = report.findings
      .filter((finding) => finding.kind === kind)
      .slice(0, 40)
      .map((finding) => `  ${finding.name}  ${finding.detail}${finding.sites?.[0] ? `  [${finding.sites[0].file}:${finding.sites[0].line}]` : ''}`)
    over.push(`${kind}: ${count} > ${CEILING[kind]}\n${lines.join('\n')}`)
  }
  for (const finding of report.findings) {
    if (finding.kind === 'UNPROVISIONED' && !DEFERRED_PROVISIONING.includes(finding.name)) over.push(`UNPROVISIONED ${finding.name}: a deployed environment requires it and the owner has not deferred it by name`)
  }
  return over
}
