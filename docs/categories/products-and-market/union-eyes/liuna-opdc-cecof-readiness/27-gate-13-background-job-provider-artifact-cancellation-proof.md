# 27 - Gate 13 Background Job And Provider Artifact Cancellation Proof

## Gate Status

`LIUNA_GATE_13_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION = SCOPED_NOT_YET_PROVEN`

This gate replaces the previous `LIUNA_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION = OPEN_OPERATING_LIMITATION` line in the readiness ledger with a bounded, provable scope. It is scoped only. It is not yet proven. It must not be cited in a recording or in claim material until this file records passing evidence.

## Scope Boundary

This gate is limited to a bounded operating control. It will not claim provider-side deletion or provider-side cancellation where the provider API cannot prove it.

In scope for proof:

- **Local cancellation and terminal state.** For every non-copilot background job type owned by Union Eyes, a revocation event drives the job record to a terminal, non-dispatching state before the next dispatch tick.
- **Prevention of further dispatch.** Once terminal, the same job cannot be re-scheduled, retried, or re-enqueued by a downstream worker.
- **Idempotency.** Cancellation is safe to invoke more than once; repeated invocations do not resurrect, duplicate, or corrupt job state.
- **Reconciliation.** A reconciliation pass detects and terminates jobs whose owning identity, membership, or authorization context has since become invalid, even if the original cancellation call was missed.
- **Observable provider-side residual state.** For every job type that hands work to an external provider, this gate documents which residuals are observable (issued SAS URLs, queued external emails/SMS, delegated notifications, generated exports, provider-side jobs) and which are not.
- **Operator escalation and manual cancellation procedure.** For residuals that Union Eyes cannot cancel via API, this gate names the operator runbook that must be followed and the evidence it must capture.
- **Evidence capture.** Every cancellation and every reconciliation decision emits an audit event with a stable correlation ID.

Explicitly out of scope for this gate:

- Claim that already-issued provider artifacts (SAS URLs, provider-side email/SMS handoffs, external webhook deliveries) are instantly invalidated.
- Claim that identity-provider token revocation is instant.
- Claim that browser cache or locally-persisted state is cleared.
- Claim that this gate closes the sensitive legal pilot posture on its own.

## Proven Behavior

`NONE_YET`

This section will be populated only when the accompanying code and tests land. Until then, the gate remains `SCOPED_NOT_YET_PROVEN`.

## Validation

Not yet run. When the implementing change lands, the following will be recorded here:

- source files and test files exercised
- `pnpm --filter @nzila/union-eyes test` scoped command
- `pnpm --filter @nzila/union-eyes typecheck`
- contract-test invocations that pin the scoped assertions

## Claim Impact

Not yet claimable. Nothing in a recording, executive summary, or client-facing document may cite Gate 13 while this file is `SCOPED_NOT_YET_PROVEN`.

Once proven, the allowed claims will be limited to:

- "Union Eyes background jobs owned by the application reach a terminal state on revocation and are not re-dispatched."
- "A reconciliation pass catches jobs whose authorization context has become invalid."
- "Provider-side residuals that Union Eyes cannot cancel via API are documented and covered by an operator runbook with evidence capture."

Prohibited claims remain, even after closure:

- "Provider-side artifacts are cancelled or invalidated by Union Eyes."
- "External email/SMS already handed off is recalled."
- "Issued SAS URLs are invalidated at the moment of revocation."
- "This closes the sensitive legal pilot posture."

## Next Gate

None. Gate 13 is the last engineering gate opened by this readiness pass. Subsequent gates should be opened only in response to discovery findings, not to pre-commit to LiUNA-specific assumptions.
