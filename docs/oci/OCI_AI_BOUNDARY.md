# OCI AI Boundary

**ARTIFACT TYPE:** Institutional Doctrine — AI Posture Disclosure
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical
**INTENDED READER:** institutional governance counsel, AI governance reviewers, member representatives
**PARENT DOCTRINE:** [docs/doctrine/DOCTRINE.md](../doctrine/DOCTRINE.md)

> AI is not the product. Continuity is the product. AI assists
> facilitators and reviewers under explicit human oversight. This
> document names the boundary, plainly, so institutions can decide
> whether the boundary matches their own AI governance posture.
>
> **This is the only canonical AI boundary document.** `ai/OCRA_AI_SYSTEM_ARCHITECTURE.md`
> and its siblings under `docs/oci/superseded/ai/` are internal engineering references — they describe
> implementation, not doctrine, and are demoted to `internal/engineering` (see
> [`SUPERSEDED.md`](./SUPERSEDED.md)). Anything the public method cites about AI, it cites
> from this document only. Where an engineering doc and this document diverge, this document governs.

---

## The boundary, stated plainly

Within OCI:

- **Reasoning is reviewer-led.** Every AI-assisted output is read,
  interpreted, and endorsed by a human reviewer before it informs
  any institutional decision.
- **There is no autonomous decisioning.** No AI surface concludes
  on behalf of the institution. No AI surface acts on behalf of
  the institution.
- **There is no behavioural inference.** No model is used to
  characterise, score, profile, or predict an individual's
  conduct, performance, or attention.
- **There is no inference about non-consented subjects.** The
  institution's members, employees, and counterparts are not
  modelled. Stewardship cartography records roles and
  responsibilities, not modelled people.

These are the four standing rules. Any feature that proposes to
relax any of them is rejected at design review.

---

## Where AI assists the work

AI-assisted reasoning is used in three bounded ways. Each is
narrow, each is reviewed, each is recorded.

### 1. Workbook interpretive assistance

When a facilitator works through the Governance Entropy Workbook
with the institution, AI-assisted reasoning may help articulate
draft language for:

- the institution's narrative paragraphs (which the facilitator and
  the institution then edit and ratify),
- the interpretive context surrounding the Stewardship Density
  Index (which the facilitator reviews and the sponsor endorses),
- cross-references between observations a steward has made and
  recognised governance patterns (which the facilitator reads and
  may discard).

No paragraph is published into the institution's workbook without
the facilitator's review. No interpretive claim is presented to
the institution as the model's view; every claim is the
facilitator's, supported (where appropriate) by the engine.

### 2. Continuity pattern recognition

The workbook's continuity pattern recognition surface uses
deterministic logic supported, in places, by AI-assisted
classification of free-text steward observations. Classification
labels are visible to the facilitator and editable; they are not
authoritative.

### 3. Document drafting

Where the engagement produces drafts (governance continuity plan
sections, communication to the governance body, facilitator
session notes), AI-assisted drafting may produce a starting text
for the facilitator's editing. The institution's name does not
appear on a document the facilitator has not read and endorsed.

---

## Where AI is not used

- **Steward evaluation.** Stewards are never characterised by a
  model. The Stewardship Density Index measures the institution's
  concentration; it does not measure individuals.
- **Member or employee profiling.** No member, employee, or
  counterpart is modelled.
- **Productivity inference.** No measure of productivity is
  inferred, displayed, or stored.
- **Engagement scoring.** Institutions are not scored or ranked.
- **Predictive risk modelling.** Continuity breakpoints are
  identified through deterministic mapping and stewardship
  observation, not through predictive modelling of individuals.

The absence of these uses is constitutive. They are not on the
roadmap.

---

## Model providers and routing

The current institutional runtime uses Microsoft Azure OpenAI
deployments:

- `gpt-4` (model `gpt-4.1-mini`) for interpretive assistance.
- `text-embedding-3-small` for retrieval-assisted lookup over
  institutional doctrine and the institution's own workbook.
- `whisper` for optional transcription (per institutional consent).

Routing is controlled by the application. The institution does not
select a model per request. Switching providers, if it ever
occurs, is treated as a subprocessor change and notified under
[OCI Data Handling](./OCI_DATA_HANDLING.md).

---

## Provenance and audit

Every AI-assisted output that informs an institutional artifact is
recorded with:

- the model deployment that produced it,
- the prompt context that produced it (within the institution's
  own retention rules),
- the facilitator who reviewed it,
- the institutional artifact in which it was used (or the note
  that it was discarded).

The facilitator's review is the authoritative event. The model
output is the input to that review.

---

## Reviewer-led conduct rules

Facilitators operate under explicit rules:

- A facilitator never presents an AI-assisted output to the
  institution as a finding.
- A facilitator never publishes an AI-assisted output without
  reading it.
- A facilitator never describes the engagement as "AI-led" or
  "AI-driven." Both phrases misrepresent the work.
- A facilitator describes the role of AI accurately when asked:
  "AI assists the facilitator. The facilitator carries the
  judgement."

Violations are incidents and are handled under
[OCI Security Overview](./OCI_SECURITY_OVERVIEW.md).

---

## Institutional AI governance alignment

Institutions with their own AI governance frameworks frequently
require:

- written disclosure of the AI uses in a vendor's service,
- absence of behavioural inference,
- absence of training on institutional data,
- a reviewer-led model with documented human accountability.

OCI's posture is aligned with each of these. Institutions may
incorporate this document into their own AI governance review and
request, under NDA, a longer technical addendum.

---

## What happens when AI is unavailable

If the AI surface is unavailable for any reason — provider
outage, deliberate institutional disablement, policy review — the
engagement continues. The workbook engines compute deterministically
without AI assistance. The facilitator drafts manually. The
institution's continuity work is not paused.

AI accelerates the facilitator. It does not constitute the work.

---

## Cross-references

- [OCI Privacy Position](./OCI_PRIVACY_POSITION.md)
- [OCI Data Handling](./OCI_DATA_HANDLING.md)
- [OCI Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI Security Overview](./OCI_SECURITY_OVERVIEW.md)
- [Anti-Surveillance Doctrine](../doctrine/ANTI_SURVEILLANCE_DOCTRINE.md)
