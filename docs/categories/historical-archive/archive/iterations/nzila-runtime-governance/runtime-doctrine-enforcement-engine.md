# Runtime Doctrine Enforcement Engine

> **Status:** Canonical runtime governance · **Layer:** Runtime enforcement · **Inherits:** [../nzila-governance/executable-doctrine-enforcement.md](../nzila-governance/executable-doctrine-enforcement.md), [../nzila-assurance/institutional-certification-framework.md](../nzila-assurance/institutional-certification-framework.md)

The **runtime doctrine enforcement engine** is the executable layer that converts Nzila doctrine into operational decisions on every request, route, render, and write. Doctrine that is enforced only at review time is doctrine that drifts. This engine ensures doctrine is enforced continuously, structurally, and observably.

---

## 1. Posture

The engine:

- **Validates** every governed act against the registered doctrine policy set
- **Decides** allow / deny / require_approval / require_review with cited reason
- **Emits** a governance event for every decision worth recording
- **Refuses** to fail open on doctrine-critical paths
- **Refuses** to extract individual behavioral data
- **Honors** continuity-safe pacing — it does not destabilize on transient signal

The engine is a guardrail, not a gate-keeper of productivity. It exists to make doctrine inhabit the runtime.

---

## 2. Enforcement Surfaces

| Surface | Enforcement Concern |
|---------|---------------------|
| Routing layer | Pilot isolation, role isolation, environment legitimacy, continuity-safe visibility |
| Authorization layer | Role governance, organization isolation, governance-safe role escalation |
| Read paths | Continuity-safe visibility, executive cognitive thresholds, anti-surveillance projection |
| Write paths | Governance-safe mutation, approval requirements, append-only commitments |
| AI invocation paths | Governance-safe AI exposure, explainability availability, human authority preservation |
| Deployment paths | Deployment legitimacy, environment identity, manifest discipline |
| Configuration changes | Doctrine-bearing configuration governance |

---

## 3. Required Capabilities

The engine validates:

- Role isolation (governance-safe role boundaries)
- Pilot discipline (pilot data does not leak to production read paths)
- Feature exposure constraints (gating per organization, environment, certification class)
- Governance-safe routing (route decisions cite doctrine source)
- Continuity-safe visibility (no surveillance projection)
- Executive cognitive safety thresholds (density, refresh cadence, notification rate)
- Continuity-safe AI exposure (AI surfaces honor governance-safe AI doctrine)
- Environment legitimacy (request originates from legitimate, identifiable environment)
- Deployment legitimacy (the running release is identifiable, manifest-bound, attested)

---

## 4. Required Implementation Surfaces

The engine is composed of the following surfaces, materialized in [packages/doctrine-enforcement](../../packages/doctrine-enforcement) and [packages/governance-runtime](../../packages/governance-runtime):

- **Doctrine policy registry** — typed registry of doctrine-bearing policies; loaded once, resolvable by id, scope, and surface
- **Enforcement middleware** — composable middleware for HTTP, RPC, and event surfaces
- **Runtime governance assertions** — small, named, citation-bearing assertions usable inline (`assertPilotIsolation`, `assertExecutiveDensity`, etc.)
- **Governance violation emitters** — typed emitters that yield governance events for telemetry pipeline ingestion
- **Doctrine enforcement adapters** — adapters that bridge enforcement decisions to platform layers (auth, routing, AI invocation)
- **Route governance validators** — validators that read route metadata and assert doctrine compatibility before render

---

## 5. Required Event Types

Emitted (typed in [packages/governance-telemetry](../../packages/governance-telemetry)):

- `doctrine_violation`
- `governance_warning`
- `continuity_risk_detected`
- `executive_cognitive_overload_risk`
- `deployment_legitimacy_failure`
- `pilot_boundary_violation`
- `governance_safe_ai_violation`

Each event carries: subject, surface, scope, doctrine citation, decision, severity, request id (aggregation-safe), environment, release.

No event carries individual behavioral payload, identity profile, or productivity attribution.

---

## 6. Decision Discipline

Decisions are:

- **Cited** — every decision references a doctrine policy id and source document
- **Bounded** — decisions apply to the scope they were reviewed against, no broader
- **Reversible** — `require_approval` and `require_review` are first-class outcomes, not failure modes
- **Calm** — decisions do not flood the operator with noise; severity is honest

Fail-closed is the default for doctrine-critical paths (pilot isolation, environment legitimacy, governance-safe AI exposure). Fail-open is permitted only for non-critical advisory checks and is explicitly recorded.

---

## 7. Anti-Patterns

- **Silent enforcement** — denying without cited reason
- **Productivity gating** — enforcing throughput, not doctrine
- **Person-resolving enforcement** — decisions encoded around individual behavior
- **Theater enforcement** — emitting events without actual decision authority
- **Cosmetic policies** — registry entries that do not actually bind any surface
- **Cross-environment leakage** — pilot enforcement applied to production paths or vice versa
- **Surveillance creep** — broadening event payloads under the banner of "audit completeness"

---

## 8. Operational Calmness

The engine is built to be **quiet by design**. Most decisions are pass; only meaningful events are recorded. Severity is reserved for actual doctrine violation. Operators who lose calmness from runtime governance noise will route around the engine — and a routed-around enforcement engine is no enforcement engine at all.

---

## 9. Discipline

The runtime doctrine enforcement engine is the place where Nzila stops describing how it would behave and begins behaving that way at every request. Its restraint, its honesty, and its evidentiary discipline determine whether doctrine inhabits the runtime or merely decorates the documentation.
