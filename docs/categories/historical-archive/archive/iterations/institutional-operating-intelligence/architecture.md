# Institutional Operating Intelligence — Architecture

> Status: **v1.0** — Institutional Cognition Kernel & Systems Convergence
> Owner: Nzila Platform / Union Eyes
> Constraint posture: **labor-safe, organizationally-scoped, no surveillance**

## Purpose

Institutional Operating Intelligence (IOI) is Nzila's architecture for
**organizationally-scoped cognition** — reasoning about the institution as a
system rather than monitoring people inside it. IOI exists to:

- Preserve and adapt institutional memory.
- Detect drift in governance, continuity, and resilience.
- Surface cross-domain dynamics with full explainability.
- Respect labor-safety constraints at every layer.

## The Kernel

All cognition flows through `@nzila/institutional-cognition-core`:

```
@nzila/institutional-cognition-core
├── ontology          → Shared institutional vocabulary
├── explainability    → InstitutionalExplainabilityEnvelope (mandatory)
├── contracts         → Canonical cognition primitives
├── governance        → Runtime labor-safety guardrails
├── reasoning         → Reasoning session lifecycle
├── orchestration     → Cross-domain orchestration runtime
├── registry          → Engine discovery
├── lifecycle         → Engine adaptation/deprecation policy
└── sdk               → defineCognitionEngine(), helpers
```

**Every cognition engine, regardless of domain, MUST:**

1. Be defined via `defineCognitionEngine(...)` from the kernel SDK.
2. Return an `InstitutionalExplainabilityEnvelope<T>`.
3. Pass `assertLaborSafe(...)` (invoked automatically by the SDK).
4. Register itself in the `cognitionRegistry`.
5. Reference shared ontology terms — no parallel taxonomies.

## Domains

The cognition domain set is **closed at v1**. New cognition domains require an
RFC and explicit governance approval. The current canonical domains are:

`governance`, `continuity`, `resilience`, `procedural_intelligence`,
`operational_trust`, `institutional_memory`, `coordination`, `adaptation`,
`precedent`, `systems_coherence`.

## Engine Map (T1 → T9)

| Engine                    | Domain(s)                | Layer (T) |
|---------------------------|--------------------------|-----------|
| systems-dynamics          | systems_coherence        | T8        |
| governance-coherence      | governance               | T8        |
| operational-coordination  | coordination             | T8        |
| operating-rhythms         | systems_coherence        | T8        |
| response-elasticity       | resilience               | T8        |
| governance-momentum       | governance               | T8        |
| multi-domain-cognition    | institutional_memory     | T9        |
| procedural-continuity     | procedural_intelligence  | T9        |
| institutional-precedent   | precedent                | T9        |
| operational-trust         | operational_trust        | T9        |
| cross-domain-correlation  | systems_coherence        | T9        |

T1–T7 (continuity, resilience baseline, institutional learning, etc.) migrate
to the kernel contracts in subsequent waves; the bridge pattern in
`apps/union-eyes/lib/institutional-operating-intelligence/kernel-bridge.ts`
is the reference template.

## Application Surface

Application code does not call individual engines directly. The single
entrypoint is:

```ts
import { runInstitutionalOperatingIntelligence } from
  '@/lib/institutional-operating-intelligence/kernel-bridge';

const result = await runInstitutionalOperatingIntelligence(organizationId);
// result.envelopes : InstitutionalExplainabilityEnvelope[]
// result.failures  : per-engine failures (isolated, never cascading)
```

## Anti-Surveillance Principles

These constraints are enforced at runtime by `assertLaborSafe`:

- ❌ No individual employee scoring or ranking.
- ❌ No predictive discipline or retention modeling.
- ❌ No identified-individual sentiment analysis.
- ❌ No employee-level unit-of-observation.
- ✅ Aggregated, organizational/role-cohort/process-level analysis only.

Violations throw `CognitionGovernanceViolation` and are logged for governance
review. There is **no opt-out** at the engine layer.

## Documents in this folder

- `architecture.md` — this file
- `explainability.md` — the envelope protocol in depth
- `governance-safety.md` — labor-safe posture and enforcement
- `ontology.md` — shared institutional vocabulary
- `extension-guide.md` — how to add a new engine (rare, requires RFC)
