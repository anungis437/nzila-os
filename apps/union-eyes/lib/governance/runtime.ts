/**
 * UnionEyes — Governance runtime bootstrap.
 *
 * Wires `@nzila/governance-middleware` into the running process by
 * adding sinks (OTel adapter + in-memory mirror for E2E) and binding
 * release identity. Called from `instrumentation.ts` during the
 * Node.js runtime register() pass.
 *
 * NEVER import this from `proxy.ts` (edge runtime). The OTel API
 * pulls in `node:crypto`, which the edge runtime cannot resolve.
 */
import { governanceEmitter, InMemoryGovernanceSink } from '@nzila/governance-middleware'
import { emitGovernanceSpan } from '@nzila/governance-otel'

let mirror: InMemoryGovernanceSink | undefined
let bound = false

export function bindGovernanceRuntime(): {
  readonly mirror: InMemoryGovernanceSink
  readonly releaseId: string
  readonly environmentClass: string
} {
  if (!bound) {
    governanceEmitter.addSink({
      name: 'otel',
      emit: (envelope) => {
        emitGovernanceSpan(envelope)
      },
    })

    mirror = new InMemoryGovernanceSink()
    governanceEmitter.addSink({
      name: 'in-memory-mirror',
      emit: (envelope) => mirror!.emit(envelope),
    })

    bound = true
  }

  return {
    mirror: mirror!,
    releaseId: process.env.NZILA_RELEASE_ID ?? 'unknown',
    environmentClass: process.env.NZILA_ENVIRONMENT_CLASS ?? 'unknown',
  }
}

/** Internal accessor used by the E2E harness. */
export function __governanceMirror(): InMemoryGovernanceSink | undefined {
  return mirror
}
