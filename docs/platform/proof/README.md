# Platform Proof Layer

> Machine-verifiable evidence that every governed control fires, chains, and
> produces auditable artifacts — not just in tests, but as a reproducible proof
> that enterprise evaluators can inspect.

## What This Proves

| Scenario | Controls Exercised | Artifacts |
|---|---|---|
| [UE Governed Mutation](ue-governed-mutation.md) | trace → auth → rate-limit → governance → audit → chain | 7 |
| [AI-Controlled Request](ai-controlled-request.md) | policy → budget → invoke → classify → spend → log | 5 |
| [Event Contract Flow](event-contract-flow.md) | contract validation → bus delivery → store → correlation | 5 |
| [Compliance-Sensitive Action](compliance-sensitive-action.md) | deny + allow governance → audit chain → export | 7 |

## Quick Start

```bash
# Run all proof scenarios
pnpm proof:run

# Run a single scenario
pnpm proof:run ue-governed-mutation

# Verify artifact completeness
pnpm proof:verify

# Clean generated artifacts
pnpm proof:clean
```

## Architecture

```
scripts/proof/
  run-proof.ts           # Orchestrates vitest + artifact summary
  verify-artifacts.ts    # Validates artifact completeness + JSON
  clean-proof-artifacts.ts

tests/e2e/platform/
  ue-governed-mutation.test.ts
  ai-controlled-request.test.ts
  event-contract-flow.test.ts
  compliance-sensitive-action.test.ts

proof-artifacts/           (generated, gitignored)
  latest-proof-summary.json
  ue-governed-mutation/
    summary.json
    trace.json
    request.json
    response.json
    governance.json
    audit.json
    audit-chain.json
  ai-controlled-request/
    summary.json
    request.json
    response.json
    ai-control.json
    trace.json
  event-contract-flow/
    summary.json
    event.json
    trace.json
    request.json
    response.json
  compliance-sensitive-action/
    summary.json
    trace.json
    request.json
    response.json
    governance.json
    audit.json
    audit-chain.json
```

## CI Integration

The proof layer runs as part of the **Governance Gates** CI job:

1. Contract tests pass
2. Governance gate passes
3. Control manifest validated
4. **Platform proof tests execute**
5. **Proof artifacts verified**
6. All artifacts uploaded as CI build artifacts (90-day retention)

## For Enterprise Evaluators

Every proof artifact is a self-contained JSON file that:

- Can be parsed by any JSON tool
- Contains trace IDs linking back to the originating request
- Includes timestamps, actor IDs, org IDs, and governance decisions
- Audit entries form a hash chain verifiable with `@nzila/audit.verifyChain()`
- Summary files contain a `status: "pass"` field for machine verification

See [Platform Proof Overview](platform-proof-overview.md) for the full technical
validation guide.
