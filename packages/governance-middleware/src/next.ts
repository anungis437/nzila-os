/**
 * @nzila/governance-middleware — Next.js helpers
 *
 * Light Next.js adapters around `applyPolicyDecision`. These return
 * `Response` instances usable directly from a Route Handler.
 *
 * Kept dependency-free of `next/server` so the package itself does not
 * need a Next.js peer dependency. Consumers pass standard `Response`
 * factories (or use the provided JSON helper).
 *
 * @module @nzila/governance-middleware/next
 */
import { applyPolicyDecision, type PolicyGateInput } from './gates'

export interface PolicyGateResponseShape {
  readonly error: 'forbidden' | 'requires_approval'
  readonly reason: string
  readonly policyId: string
  readonly policyVersion: string
}

/**
 * Evaluate a policy decision and, if disallowed, return a calm,
 * non-leaking `Response`. Returns `null` to indicate the caller should
 * proceed with handling.
 */
export async function withPolicyGate(
  input: PolicyGateInput,
): Promise<Response | null> {
  const outcome = await applyPolicyDecision(input)
  if (outcome.allowed) return null

  const body: PolicyGateResponseShape = {
    error: outcome.httpStatus === 403 ? 'forbidden' : 'requires_approval',
    reason: outcome.evaluation.reason,
    policyId: outcome.evaluation.policyId,
    policyVersion: outcome.evaluation.policyVersion,
  }

  return new Response(JSON.stringify(body), {
    status: outcome.httpStatus,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Attach calm governance headers to an outbound response. These never
 * include person-resolving information.
 */
export function attachGovernanceHeaders(
  response: Response,
  context: {
    readonly releaseId: string
    readonly correlationKey?: string
  },
): Response {
  const headers = new Headers(response.headers)
  headers.set('x-nzila-release-id', context.releaseId)
  if (context.correlationKey) {
    headers.set('x-nzila-correlation', context.correlationKey)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
