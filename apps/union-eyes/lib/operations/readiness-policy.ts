/** Deployment-owned profile; request headers and interactive roles cannot select it. */
export const BASE_RELEASE_PROFILE = 'union-eyes-v2-base'

function enabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase())
}

export function readinessPolicy(env: NodeJS.ProcessEnv = process.env) {
  const declared = env.UE_RELEASE_PROFILE?.trim()
  const base = declared === BASE_RELEASE_PROFILE
  return {
    profile: base ? BASE_RELEASE_PROFILE : declared ? 'invalid' : 'legacy',
    valid: !declared || base,
    // The base release exposes governed case writes and document intake. Its
    // signing key, document storage and malware scanner are required even if
    // an older optional-readiness switch is explicitly set to false.
    decisionProof: base || enabled(env.READY_REQUIRE_DECISION_PROOF),
    storage: base || enabled(env.READY_REQUIRE_STORAGE),
    scanner: base || enabled(env.READY_REQUIRE_SCANNER),
  }
}
