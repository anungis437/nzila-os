# CIVIC ↔ OCI Alignment

**ARTIFACT TYPE:** Positioning Doctrine — Cross-Tree Alignment
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical
**AUDIENCE:** Anyone editing `docs/oci/`, `docs/public-service/`, or preparing external
correspondence (executive briefings, forwardable intros, validation packets).

> **One-line rule:** CIVIC is the public-service front door for OCI. It is a
> positioning and framing layer, not a fork of the methodology, not a different
> product, and not a competing scoring system.

---

## 1. The three names, resolved

The repository uses three families of terminology. This is deliberate — different
audiences enter through different doors — but they all describe the same underlying
work.

| Name | Layer | Audience | Where it lives |
| --- | --- | --- | --- |
| **OCI** — Organizational Continuity Intelligence (the one expansion; see [`OCI_METHOD.md`](./oci/OCI_METHOD.md)) | Methodology + product ladder + scoring architecture | Internal stewards, sponsoring institutions, procurement evaluators, certified facilitators | [`docs/oci/`](./oci/) |
| **OCRA** — Organizational Continuity Recognition Assessment | Product 1 of OCI, the Recognition-phase instrument | Government / procurement evaluators, all institutional buyers | [`docs/oci/OCI_METHOD.md`](./oci/OCI_METHOD.md) (canonical); [`docs/oci/government-readiness/`](./oci/superseded/government-readiness/) is `premature`/internal detail — see [`docs/oci/SUPERSEDED.md`](./oci/SUPERSEDED.md) |
| **CIVIC by Nzila** | Public-service front door — the positioning, brand, and forwardable framing | Federal / provincial / municipal public-service leaders receiving a first introduction | [`docs/public-service/`](./public-service/) |
| **CLEAR** | The public-service articulation of the OCI evidence discipline | Public-service leaders reading the CIVIC brief; anyone explaining "the method behind the framing" | [`docs/public-service/clear-method-canonical.md`](./public-service/clear-method-canonical.md) |

CIVIC and CLEAR are how the OCI methodology **presents itself** to a public-service
reader. They do not replace OCI, OCRA, or the frozen scoring core. They are the
first-touch language.

---

## 2. What is the same, and must stay the same

The following are **frozen** across every framing — CIVIC, CLEAR, OCI, OCRA — and
enforced by the government-readiness non-regression suite:

- Five scoring dimensions, weights, and the composite (`institutional_continuity`).
- Five maturity bands.
- Fairness rule: institutional context changes interpretation labels only, never the
  number.
- Comparability invariant: one universal 0–100 scale; core questions always included.
- Anti-surveillance posture and the five-layer AI boundary (AI never scores, decides,
  routes, or profiles).
- Observatory rules: opt-in, k-anonymity K=5, no rankings, refusal-first.
- Human review is authoritative; the method supports decisions, it does not make them.

See [OCI/OCRA Government Readiness — non-negotiable freeze](oci/superseded/government-readiness/README.md#the-non-negotiable-freeze).

Any CIVIC or CLEAR document that appears to soften, contradict, or reinterpret these
must be corrected against the OCI/OCRA sources, not the other way around.

---

## 3. What is different, and why that is intentional

| Difference | OCI / OCRA | CIVIC / CLEAR | Why the difference exists |
| --- | --- | --- | --- |
| **First-touch language** | "Institutional continuity intelligence," "dimensions," "scoring core," "obligation taxonomy" | "Public-service continuity," "pillars," "evidence discipline," "human review authoritative" | A deputy minister or ADM should not receive procurement/architecture language on the first touch. |
| **Named artifacts** | Dimensions, findings, obligations, consequences, confidence envelope, source instruments | Pillars, questions to ask, warning signs, observable evidence, briefs, notes | CIVIC/CLEAR describe what a leader can *see and act on*; OCI/OCRA describe what the system *persists and validates*. |
| **Entry format** | Executive email sequence → pilot introduction → pilot framework → assessor certification | Forwardable intro → one-page brief → conversation → (later) briefing → (much later) any product step | CIVIC is deliberately pre-product. It exists to make a framing forwardable **before** any offer is on the table. |
| **What may be requested** | A pilot, an assessment, a certification, a validation binder | Feedback, a conversation, a briefing tailored to context | CIVIC front-door conversations must not introduce commercial terms, engagements, demos, or trials. |

---

## 4. Rosetta table — how the five pillars line up

The three pillar sets are **compatible views** of the same concerns. They are not
competing taxonomies. When in doubt, the OCI dimension names are the technical
canonical form (they are what the scoring core reads).

| OCI dimension (technical, frozen) | CLEAR pillar (public-service articulation) | CIVIC letter (public-service brand) | Same concern, in one sentence |
| --- | --- | --- | --- |
| `institutional_continuity` (composite) + `transition_readiness` | **C**ontinuity | **C** — Continuity | Will critical institutional knowledge and service logic survive change? |
| Governance-authority / mandate-fit traces | **L**egitimacy | **I** — Implementation *(implementation of authorised policy, procedural fairness, official languages, accessibility, GBA Plus)* | Is what is done authorised, fair, and defensible in operation? |
| Evidence ladder (`VERBAL` → `DOCUMENTED` → `VERIFIED` → `CROSS_VALIDATED`) + `questionTraces` | **E**vidence | **V** — Visibility | Can the institution show its work, not just assert it? |
| Obligation taxonomy (seven classes) + explainability contract | **A**ccountability | **I** — Integrity | Is it clear who owns the decision and how it can be reviewed? |
| `governance_fragility` (inverted) + modernization-pressure inputs | **R**eadiness | **C** — Capacity | Is the institution prepared to modernize without losing control? |

**Reading rule.** A pillar/letter/dimension in one column is a *view* of the concern
in that row — it is not a new metric. Nothing in CIVIC or CLEAR introduces a new
number, band, or ranking beyond what OCI/OCRA already computes.

---

## 5. Doctrine consistency rules for authors

When editing any file under `docs/oci/`, `docs/public-service/`, or a Richard
packet:

1. **Never restate the frozen list from §2 in a way that softens or contradicts it.**
   Link to [`docs/oci/government-readiness/README.md`](oci/superseded/government-readiness/README.md)
   or [`docs/oci/OCI_AI_BOUNDARY.md`](./oci/OCI_AI_BOUNDARY.md) instead.
2. **Never introduce a new pillar name, new dimension, or new maturity band** in
   CIVIC/CLEAR without a matching change to OCI/OCRA doctrine and its non-regression
   suite. Additive framing is fine; additive metrics are not.
3. **Never propose an assessment, pilot, procurement step, commercial term, demo,
   or trial in a CIVIC front-door document.** Those belong in the OCI tree.
4. **Never introduce OCRA / procurement / scoring language into a CIVIC front-door
   document.** Those belong in the OCI or government-readiness tree.
5. **When a CIVIC/CLEAR document needs technical backing, link across.** Do not
   inline the technical claim in public-service voice — a public-service reader
   should not have to parse architecture prose.
6. **When an OCI/OCRA document needs public-service framing, link across.** Do not
   inline forwardable-intro language in a doctrine or architecture document.

---

## 6. The two "Richard" tracks, resolved

The repository contains two `Richard`-titled packages. They serve different
purposes and are both correct — but must not be conflated.

| Package | Purpose | Audience | Track |
| --- | --- | --- | --- |
| [`docs/oci/government-readiness/richard-packet/`](./oci/superseded/government-readiness/richard-packet/) — **Richard Sharpe Validation Packet** | Adversarial senior-public-sector review of the OCI/OCRA government-readiness architecture (protocol, workbook, verdicts) | Simulated deputy-minister-grade validator | **OCI / OCRA** technical validation |
| [`docs/public-service/forwardable/`](./public-service/forwardable/) — **Richard First-Send Package** | External forwardable outreach: what Richard sends to a public-service leader as a first, feedback-only introduction to CIVIC | Public-service leaders reachable through Richard's network | **CIVIC** public-service front door |

If in doubt: the government-readiness Richard packet is *inbound* validation
(pressure-test the architecture); the CIVIC Richard first-send package is
*outbound* framing (introduce the public-service conversation).

---

## 7. Cross-references (canonical list)

- CIVIC front door: [`docs/public-service/civic-thesis.md`](./public-service/civic-thesis.md),
  [`docs/public-service/civic-one-page-brief.md`](./public-service/civic-one-page-brief.md),
  [`docs/public-service/forwardable/civic-one-page-brief-executive.md`](./public-service/forwardable/civic-one-page-brief-executive.md)
- CLEAR method: [`docs/public-service/clear-method-canonical.md`](./public-service/clear-method-canonical.md),
  [`docs/public-service/clear-method-note.md`](./public-service/clear-method-note.md)
- OCI method (canonical, single file): [`docs/oci/OCI_METHOD.md`](./oci/OCI_METHOD.md) —
  `docs/oci/oci-method.md` is a redirect stub, see [`docs/oci/SUPERSEDED.md`](./oci/SUPERSEDED.md)
- Canon (2-page summary): [`docs/oci/CANON.md`](./oci/CANON.md)
- Government-readiness program (`premature`, not part of the public method surface): [`docs/oci/government-readiness/README.md`](oci/superseded/government-readiness/README.md)
- Frozen scoring core reference: [`docs/oci/government-readiness/README.md#the-non-negotiable-freeze`](oci/superseded/government-readiness/README.md#the-non-negotiable-freeze)
- AI boundary: [`docs/oci/OCI_AI_BOUNDARY.md`](./oci/OCI_AI_BOUNDARY.md)
- Anti-surveillance position: [`docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`](./oci/OCI_ANTI_SURVEILLANCE_POSITION.md)
- Human-review principles: [`docs/public-service/human-review-and-evidence-principles.md`](./public-service/human-review-and-evidence-principles.md)
