# OCRA Facilitator Interpretation Guide

**Status:** Active doctrine
**Doctrine version:** 1.0.0
**Audience:** Facilitators, advisors, internal stewards, and auditors who read
adaptive ICRA/OCRA assessment output and translate it into operational
conversation.
**Pair with:**
[OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md](OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md),
[OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md](OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md).

---

## 1. Purpose

The OCRA dynamic questionnaire **adapts** to institutional profile before,
during, and after the assessment. This guide tells a facilitator:

- What the system did adaptively (so they can see it).
- What the system did *not* do (so they don't over-read).
- How to talk about an adaptive result with the institution it describes.

A facilitator should be able to defend every line of an OCRA report by
pointing at the corresponding profile dimension, rule id, and statement in
the `FacilitatorGuide` payload.

---

## 2. The four adaptive moves the system makes

The system makes **exactly four** adaptive moves. Anything in the report that
is not on this list is **not** adaptive — it is the raw assessment result.

### 2.1 Routing

Some questions are **deferred** because they cannot be answered honestly by
this profile (e.g. a multi-site governance question for a single-office
local). Deferred questions do not contribute to the score.

**Facilitator read:** if `routedSafely === false`, the respondent saw the
full bank. Treat the routing layer as inert for this assessment.

### 2.2 Emphasis

Narrative emphasis is shifted by profile. A small organization will read
more about trust-debt; a federation will read more about governance
fragility; a mission-critical institution will read more about institutional
continuity.

**Facilitator read:** emphasis affects *what the narrative talks about
first*. It does **not** change scores.

### 2.3 Interpretation

Severity bands are tuned by `continuityExposure`. A composite of 70 is
"workable" for a local under default exposure and "concerning" for a health
authority under mission-critical exposure. The raw number is identical;
the framing is different because the stakes are different.

**Facilitator read:** if a stakeholder asks "why is 70 read differently for
us?" the answer is: *because the consequences of a continuity gap are
different for your institution, and the assessment is honest about that.*

### 2.4 Warning filter

Observations whose substance does not apply at this scale are filtered out
(e.g. "multi-region runtime governance" for a 7-person local). The filter is
a small, explicit allowlist of substrings; nothing else is suppressed.

**Facilitator read:** if `warning_filter` rationale appears in
`adaptationDecisions`, the system removed an enterprise-only observation. If
you want to see the unfiltered list, look at `rawProfile.observations`.

---

## 3. Things the system explicitly does *not* do

These are **forbidden** moves. If you see one, file an issue.

- **Score adjustment.** The composite is never multiplied, shifted, or
  rebanded by profile. Only its interpretation framing changes.
- **AI inference.** No language model is in the path. All adaptation is
  pure deterministic enum-driven rules.
- **Behavioural profiling.** No keystroke timing, dwell time, click path, or
  similar signal contributes to adaptation.
- **Free-text routing.** No respondent free text changes which questions are
  shown.
- **Hidden adaptation.** Every adaptation decision is enumerated in
  `adaptationDecisions` with a rule id and a one-sentence rationale.
- **PII in the profile.** The profile carries only low-cardinality enum
  tokens; never names, emails, addresses, IDs of individuals, or geographic
  detail finer than what was declared in the form.

---

## 4. Reading the FacilitatorGuide payload

A typical guide payload contains:

```ts
{
  doctrineVersion: '1.0.0',
  profileBand: 'large|complex|federated|public_trust|board_governance',
  routedSafely: true,
  routingFallbackReason: null,
  routingCounts: { included: 31, deferred: 6, required: 4, optionalContext: 8 },
  interpretationCautions: [
    'Federated-complex assessment: a strong score in one unit does not generalize…',
  ],
  adaptationDecisions: [
    { area: 'emphasis', ruleId: 'emphasis.federation.governance_fragility', statement: '…' },
    { area: 'interpretation', ruleId: 'interpretation.public_trust_bands', statement: '…' },
  ],
}
```

### 4.1 `profileBand`

Five enum tokens, pipe-separated. This is what the system used to make every
adaptive decision. If you disagree with one of the tokens, **re-run the
assessment with corrected context**; do not patch the report.

### 4.2 `routedSafely`

`true` means the routing engine narrowed the bank with confidence. `false`
means it fell back to the full bank because either inputs were partial or
the routed set was smaller than the safe-default threshold. Either is
valid; both are auditable.

### 4.3 `interpretationCautions`

A short, profile-driven list of things a reader should keep in mind. These
are **not** scored findings; they are reading instructions. Always read
them aloud at the start of a debrief.

### 4.4 `adaptationDecisions`

Every adaptive move, with rule id. A facilitator should be ready to point
at this list and explain *which* rules fired and *why*.

---

## 5. Stewardship for specific profiles

### 5.1 Small / micro institutions

- The honest question is **structural relief for trusted individuals**, not
  enterprise infrastructure. Resist the urge to import a corporate
  continuity vocabulary.
- A low composite here often means *one person carries continuity without
  backup*. That is a structural finding, not a personal one. Frame it as
  such.

### 5.2 Federated / federated-complex institutions

- A strong reading from one unit **does not** generalize. The operative
  variable is coordination quality.
- If `governance_fragility` is emphasized, the conversation is about
  alignment between units, committees, and affiliated bodies — not about
  any single unit's diligence.

### 5.3 Mission-critical / public-trust institutions

- Severity bands are appropriately higher. A finding that would be
  "workable" for a small local is "concerning" here. That is doctrine, not
  bias.
- Always pair the continuity reading with the question: *who would feel the
  gap first, and how quickly?*

### 5.4 External advisors and counsel

- The respondent caveat is non-optional. Surface it visibly in the debrief.
- Findings should be validated with internal stewards before being used to
  direct operational change.

---

## 6. When the adaptation disagrees with the room

If the assessment reads "concerning" but the room reads "fine", the
facilitator's job is not to defend the score. It is to:

1. Point at the `interpretationCautions` and the `profileBand`.
2. Read aloud which rules fired.
3. Ask the institution which of those rules is mis-applied to their context.
4. If a profile dimension is wrong, **re-run the classifier with corrected
   context** and re-read.

The adaptation is not a verdict. It is a *negotiated reading* between the
form responses, the profile classifier, and the institution's lived
experience. The facilitator's authority is to mediate that negotiation, not
to override it silently.

---

## 7. Version discipline

This guide is locked to **doctrine version 1.0.0**. Any change to the
adaptation surface — new profile dimension, new rule, changed band — must:

1. Bump `ADAPTATION_DOCTRINE_VERSION`.
2. Update this guide.
3. Update both passage locales (`en-CA` and `fr-CA`).
4. Refresh the narrative + facilitator tests.
5. Note the change in the OCRA model document under §Changelog.

A report stamped with an older doctrine version should be re-run, not
re-interpreted under newer rules.
