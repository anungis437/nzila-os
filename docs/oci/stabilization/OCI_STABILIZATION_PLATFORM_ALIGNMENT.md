# OCI Stabilization Platform Alignment

**Status:** Canonical doctrine. Maps Product 3 doctrine surfaces to the Nzila OS platform packages that may carry, support, or interface with stabilization work. Binding for engineering teams scoping platform support for Product 3.

**Audience:** Platform engineering teams, certified facilitators evaluating tooling support, governance bodies reading the framework's posture toward platform infrastructure, internal stewards of the Nzila OS package boundaries.

---

## 1. Purpose

OCI Stabilization Platform Alignment names which Nzila OS platform packages may legitimately carry Product 3 surfaces, which packages must not, and the boundary conditions under which each alignment holds.

It exists so that platform engineering does not infer alignment from package adjacency, and so that the institution entering Product 3 can read with confidence which platform surfaces, if any, may touch its engagement.

This document is doctrinal, not architectural. It names what is allowed and what is prohibited; it does not specify implementation.

---

## 2. The seven platform packages in scope

The Nzila OS packages relevant to Product 3 alignment are:

1. `@nzila/platform-auth` — authentication and session governance.
2. `@nzila/platform-audit` — audit trail and evidence capture.
3. `@nzila/platform-consent` — consent surfaces and revocation handling.
4. `@nzila/platform-cognition` — cognition envelopes and reasoning surfaces.
5. `@nzila/platform-governance` — governance receipts and ratification surfaces.
6. `@nzila/platform-doctrine` — doctrine reference and tone-discipline gates.
7. `@nzila/platform-intelligence` — anonymised pattern intelligence (Product 5 surface).

No other platform package may be assumed to carry a Product 3 surface without explicit doctrine extension.

---

## 3. Alignment table

| Package | Stabilization role | Boundary |
|---|---|---|
| platform-auth | Authenticates facilitator access to engagement workspaces; segregates institution workspaces; records facilitator session identity for audit. | Must not authenticate the institution's stewards for the framework's benefit; institution stewards authenticate to their own workspace under their own identity. |
| platform-audit | Captures action evidence (`OCI_ACTION_SYSTEM.md` §5) and engagement closure records as institution-owned audit material. | The audit trail is the institution's property; the framework retains no copy outside the engagement workspace once the engagement closes. |
| platform-consent | Renders, records, and revokes the consent surfaces named in `OCI_ONBOARDING_STABILIZATION.md` §5 and `OCI_STABILIZATION_EVOLUTION.md` §6. | Consent is read continuously; the platform must surface re-read prompts at each stage transition, not infer continuing consent. |
| platform-cognition | May render facilitator-side reasoning envelopes (e.g. the `stewardshipRedistributionEngine` and `governanceRecoveryEngine` previews) for facilitator preparation. | Must not render institution-facing recommendations during stabilization moves; institution receives facilitated artefacts, not engine output. |
| platform-governance | Records governance ratifications, lineage entries, and continuity-debt retirement receipts (`OCI_CONTINUITY_DEBT.md`). | Ratifications are the institution's governance act; the platform records receipts, it does not author ratifications. |
| platform-doctrine | Carries the doctrine corpus, tone-discipline regex gates, and the forbidden-vocabulary surface enforced in engine tests. | Doctrine is read at the platform layer; institution-facing surfaces never expose the doctrine corpus directly without facilitator framing. |
| platform-intelligence | Carries the Product 5 anonymised pattern surface (when, and only when, an institution has consented under `OCI_STABILIZATION_EVOLUTION.md` §6). | Never touches institution-identifying or person-level material; aggregates only above the k-anonymity threshold named in `OCI_STABILIZATION_TRACKING.md`. |

---

## 4. Packages structurally prohibited from Product 3 surfaces

The following package categories are prohibited from carrying Product 3 surfaces, even in adjacent or supporting roles:

- Any package whose primary surface is performance measurement of individuals.
- Any package whose primary surface is comparative ranking of institutions.
- Any package whose primary surface is predictive behavioural inference.
- Any package whose primary surface is engagement-scoring of stewards or members.
- Any package whose primary surface is third-party advertising or marketing inference.

Engineering proposals that route Product 3 material through any of the above are referred to the certification body and to platform governance review.

---

## 5. Workspace isolation requirement

A Product 3 engagement workspace is isolated at the platform level. The isolation requirement holds across all seven aligned packages:

- Engagement workspaces are tenanted at the institution level, not at the facilitator level.
- Cross-workspace queries are structurally prohibited (no facilitator dashboard aggregates across institutions).
- Engine output rendered for facilitator preparation is scoped to the single engagement workspace and is purged at engagement closure unless the institution has consented to anonymised pattern contribution under `OCI_STABILIZATION_EVOLUTION.md` §6.

---

## 6. Engine surface alignment

The two Product 3 composition engines — `stewardshipRedistributionEngine` and `governanceRecoveryEngine` — align as follows:

- They are composition surfaces over existing platform engines; they do not introduce new analytics.
- They are facilitator-side only; their preview text is not rendered to institution-facing surfaces during a stabilization move.
- Their output may be carried into the Governance Entropy Workbook™ Chapter 08 (facilitated-edition only) for institution receipt under facilitator framing.
- They are subject to the same tone-discipline regex gates as the canonical engines (`transformationRoadmapEngine.ts`).

---

## 7. Doctrine gate at the platform layer

`platform-doctrine` carries the doctrine corpus and the tone-discipline gates. The platform must enforce, at engine boundary:

- The forbidden-vocabulary regex (institutional tone register).
- The blame-framing regex (no "why do you not" constructions).
- The anti-surveillance posture (no person-level signal categories).
- The k-anonymity floor (aggregations report only above k=5 default, never below k=3).

A platform release that weakens any of these gates is referred to the certification body before deployment.

---

## 8. Versioning and platform change

A change to any of the seven aligned packages that affects a Product 3 surface follows the doctrine evolution posture named in `OCI_STABILIZATION_EVOLUTION.md` §7. Platform releases that materially change a binding gate require the 180-day comment window and certification-body ratification before taking effect in any production Product 3 engagement.

---

## 9. Cross-references

- `OCI_METHOD.md` — method-level position of platform alignment.
- `OCI_ACTION_SYSTEM.md` — persistence sketch that platform-audit and platform-governance support.
- `OCI_STABILIZATION_TRACKING.md` — tracking discipline that constrains platform-intelligence aggregations.
- `OCI_STABILIZATION_EVOLUTION.md` — downstream product alignment that platform-intelligence carries.
- `OCI_INTERVENTION_ETHICS.md` — ethical commitments that bind platform engineering proposals.

---

## 10. Doctrine references

This document is bound by the framework's foundational positions:

- `OCI_ANTI_SURVEILLANCE_POSITION.md` — anti-surveillance posture enforced at the platform layer.
- `OCI_AI_BOUNDARY.md` — AI boundary observed in cognition and intelligence package alignments.
- `OCI_DATA_HANDLING.md` — data-handling posture observed across all aligned packages.
