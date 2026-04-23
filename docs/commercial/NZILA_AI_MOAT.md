# NZILA AI MOAT

> What makes Nzila's intelligence layer defensibly different from a generic
> LLM wrapper.

## The trap most "AI startups" walk into

The dominant pattern in 2025-26 SaaS is *foundation-model wrapper as
product*: a vector store, a system prompt, a chat UI. The moat is whatever
the underlying model + vendor terms allow today, which is approximately
nothing.

Nzila's IP is not the foundation model. Nzila's IP is the **stateful,
consent-native, longitudinal intelligence substrate** that sits underneath
every product and that competitors cannot copy by switching providers.

## What we built

| Layer | What competitors typically do | What Nzila does |
|---|---|---|
| **Memory** | Conversation history per session, dropped on logout. | Per-subject episodic + semantic + preference + decision + trust memory, with recency-weighted decay, tag-weighted recall, and explicit redaction lifecycle. Subject = (tenant, org, user?, entity?) — same memory composes a case file, a member profile, and a customer relationship. |
| **Trajectory** | Point-in-time anomaly alerts. | Sequence-feature risk scoring with per-feature contributions: churn, escalation, aging, disengagement, progression. Every score is auditable. Confidence is a function of data sufficiency, not a vibe. |
| **State** | None — the user is treated as static. | Explainable inference of confusion, fatigue, frustration, urgency, confidence, disengagement from operational telemetry. The product can adapt its UX *to the human*, not just to the data. |
| **Consent** | Cookie banner + ToS acceptance. | A fail-closed gate that intersects subject policies with jurisdiction profiles (CA Law 25, GDPR, sectoral US, conservative AF default). Producer exceptions become `allowed: false`, never silent leakage. Retention windows enforced on every recall. Mandatory tag exclusions at jurisdiction level (SIN, RAMQ, biometric, etc.). |
| **Composition** | Standalone "AI features." | The trajectory engine emits `OperationalSignal`s in the exact shape the existing `@nzila/platform-decision-engine` already consumes. Cognition does not replace any existing engine — it *feeds* them. |

## Five durable advantages

### 1. Intelligence with memory, not chat with history

Memory is **scoped, decaying, and consent-aware** — the same record can
inform a recommendation today and be silently excluded tomorrow when the
subject withdraws consent for the relevant zone. The default is *forgetting,
not retention*.

A foundation model gives you "Q&A about a document." We give you "what does
this organisation know about this subject right now, with what confidence,
under what consent, and what should we do about it."

### 2. Longitudinal, not point-in-time

The existing `platform-anomaly-engine` answers "is now weird?". The trajectory
engine answers "is this *trajectory* heading somewhere bad?". Those are
different questions and competitors mostly only have the first.

Sequence features (frequency slope, mean inter-event gap, escalation density,
signed valence load) are computed from the same memory store, so the same
event simultaneously shapes recall ranking, preference accumulation, *and*
risk scoring. One write → five capabilities.

### 3. Consent-native, not consent-bolted-on

The gate is **fail-closed**. A producer that throws returns
`allowed: false` with the exception message in the reasons array — never an
unhandled rejection that might surface as silent disclosure.

Jurisdiction profiles are **conservative by default** (Quebec Law 25 denies
training, EU GDPR denies cross-product + training, AF defaults match GDPR
pending per-country profiles). The intersection of policy and jurisdiction
always wins.

This matters in regulated verticals — labour relations (Union Eyes),
mobility/immigration, finance (CFO), healthcare-adjacent (CareAI). Every one
of those is a market where *any* compliance surprise terminates the deal.

### 4. Human-state aware, not data-state aware

Most operational AI scores entities (cases, customers, deals). The state
engine scores **the human in the loop**: are they confused, fatigued, near a
deadline, disengaged? The signal mix is intentionally explainable — repeat
actions, help-event density, error density, deadline proximity, completion
rate.

This unlocks UX that *adapts* — surface a steward suggestion when a member
is fatigued; defer a risky decision when an investigator is near a deadline
without enough completion-evidence. None of this is possible with a
stateless LLM wrapper.

### 5. Honest about what's trained vs. heuristic

Every model in the package ships with a `modelVersion` string and an exported
registry. Phase-1 models are **interpretable, version-pinned logistic
calibrations** because we do not yet have labeled training data for these
verticals. Pretending otherwise would be the kind of AI fiction that erodes
trust on the first failed audit.

When `@nzila/ml-core` promotes a trained model with the same feature
contract, the kind's registry entry is updated and the version bumps. Call
sites do not change.

This honesty is itself a moat. It survives due diligence, regulatory
review, and customer audits in a way "we use AI" marketing copy does not.

## Why this is hard to copy

A competitor with infinite engineers cannot copy this without rebuilding
six things in coordination:

1. The subject schema and the disciplined `(tenant, org, user?, entity?)`
   key that makes every memory event scope-correct from day one.
2. The redaction lifecycle (soft → hard, audit-preserving) that survives
   regulator-level scrutiny.
3. The jurisdiction profile catalogue and the **fail-closed gate semantics**
   that turn consent from documentation into a runtime invariant.
4. The interpretable feature/contribution contract that lets the same score
   surface in (a) a recommendation, (b) an audit log, (c) a UI explain-panel
   without re-derivation.
5. The `OperationalSignal` adapter that lets cognition feed an existing
   decision pipeline without owning rules.
6. The `STATUS.md` discipline of telling the truth about which models are
   trained.

Copying any one of these is a quarter of work. Copying all six in a way
that composes is a year. By then we have Phase-2 trained models and a
labeled-data flywheel that genuinely is hard to catch.

## What this is NOT

- Not a foundation-model strategy.
- Not a prompt-engineering moat.
- Not a vector-store-as-product.
- Not a guarantee of accuracy — it is a guarantee of **discipline**: every
  score is interpretable, every recall is consented, every model is
  versioned, every deferral is documented.

## Roadmap (12 months)

- Q1: Bind memory + consent to Postgres; persist score history; drift
  monitoring on feature distributions; wire Union Eyes (most data-rich) as
  the first integrated vertical.
- Q2: First trained model from `@nzila/ml-core` (escalation-risk on Union
  Eyes labels); validate the version-bump swap path end-to-end.
- Q3: FairCase, Flow, Zonga adapters. Cross-product memory sync gated on
  `cross_product` consent.
- Q4: Cora/Agrimo (yield trajectory), CareAI/Memora (routine drift). Per-
  country AF jurisdiction profiles.

## Estimated commercial moat value

Hard to dollar-quantify pre-revenue, but the qualitative gating effect:

- **Regulated-vertical sales cycles:** the consent gate removes the largest
  AI-related deal-blocker (compliance surprise). High-value, high-friction
  contracts (union locals, immigration partners, finance teams) become
  *closeable* at all.
- **Multi-product upsell:** the same memory substrate composes across
  verticals. Selling Union Eyes + Flow + CareAI to one organisation becomes
  meaningfully cheaper to operate than selling three siloed products.
- **AI durability:** when a foundation model price/terms changes, our IP
  does not move. Wrappers are exposed; we are not.

## Read this with

- [`packages/platform-cognition-core/README.md`](../../packages/platform-cognition-core/README.md)
- [`packages/platform-cognition-core/STATUS.md`](../../packages/platform-cognition-core/STATUS.md)
- [`packages/platform-decision-engine/README.md`](../../packages/platform-decision-engine/README.md)
  (the existing pipeline cognition feeds)
