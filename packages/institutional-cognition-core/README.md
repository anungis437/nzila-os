# @nzila/institutional-cognition-core

The canonical institutional cognition substrate for Nzila OS / Union Eyes.

This package is **the heart of institutional operating intelligence**. All
cognition systems (T1–T9 — continuity, governance, resilience, institutional
learning, procedural intelligence, precedent, trust, systems dynamics,
multi-domain cognition) MUST converge on the contracts, ontology,
explainability protocol, and orchestration primitives defined here.

## Modules

| Path                    | Purpose                                                      |
|-------------------------|--------------------------------------------------------------|
| `./contracts`           | Canonical cognition contracts (sessions, reasoning chains,   |
|                         | simulations, forecasts, memory, propagation, resilience…)    |
| `./explainability`      | Unified `InstitutionalExplainabilityEnvelope` protocol       |
| `./reasoning`           | Standardized reasoning lifecycle + simulation protocols      |
| `./orchestration`       | Cross-domain cognition orchestration runtime                 |
| `./ontology`            | Shared institutional semantics (governance, continuity, …)   |
| `./governance`          | Labor-safe, organizationally-scoped cognition guardrails     |
| `./registry`            | Cross-domain intelligence registry                           |
| `./lifecycle`           | Cognition lifecycle and adaptation governance                |
| `./sdk`                 | Developer cognition SDK (builders, helpers, defaults)        |

## Architectural Rules

1. **No local cognition types.** All cognition consumers must import from
   `@nzila/institutional-cognition-core/contracts`.
2. **No parallel reasoning pipelines.** Use `reasoning/` lifecycle helpers.
3. **Every engine returns an explainability envelope.** No opaque outputs.
4. **Organizational scope only.** Never employee-level analysis.
5. **Labor-safe posture is non-negotiable.** Governance gates enforced at runtime.

See `docs/institutional-operating-intelligence/` for the full architecture map.
