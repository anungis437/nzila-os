# Feedback Intake Protocol

> Internal governance material. Defines how feedback from Richard, institution contacts, advisors,
> public-sector operators, and reviewers is captured and processed. This is not a public route, UI,
> product page, or outreach asset.

## 1. Purpose

CIVIC, CLEAR, SAGE, and the Public-Institution Adaptation Framework are now stable. As real
conversations begin, external reactions will arrive — some sharp, some casual, some contradictory.
This protocol exists so that feedback becomes **structured evidence**, not noise, and so the stack is
never rewritten on the strength of a single reaction.

The discipline is simple: capture everything, classify it, and change canonical material only when the
signal is strong, repeated, and boundary-safe.

## 2. What counts as feedback

Feedback is any reaction that tells us something usable about whether the framing lands, where it
fits, where it confuses, or where it risks going wrong. It includes what resonated, what confused,
what was objected to, what was requested, and who else was suggested. A reaction is feedback whether
or not it asks for a change; the change decision is ours, made through this protocol.

## 3. Feedback sources

- Richard (initial forwarding contact)
- institution contacts reached through Richard or others
- advisors and trusted reviewers
- public-sector operators and practitioners
- accessibility, privacy, records, or equity practitioners commenting in their domain
- anyone who has seen the CIVIC front door, the article, or the executive brief

Weight sources by role relevance and institution relevance (see the signal-classification rubric), not
by enthusiasm.

## 4. Intake principles

- **Capture first, judge later.** Record the reaction before deciding what it means.
- **Preserve their words.** Note the exact language people use; it is evidence about framing.
- **Separate signal from noise deliberately**, using the rubric — never by gut in the moment.
- **Minimize sensitive material.** Do not record confidential, personal, privileged, or
  protected-domain content (see the conversation-notes template reminder).
- **One reaction is a data point, not a mandate.** Patterns across conversations carry the weight.
- **Boundaries are not negotiable inputs.** Feedback can reshape framing; it cannot weaken the
  non-negotiable boundaries.

## 5. Feedback categories

Every captured item is tagged with one or more categories:

- **clarity signal** — something was clearer or muddier than expected
- **resonance signal** — something landed and mattered to them
- **confusion signal** — something was misunderstood or unclear
- **objection** — they disagreed or pushed back
- **risk signal** — they flagged a reputational, political, or institutional risk
- **institution-fit signal** — something about fit for their institution type
- **language adaptation signal** — a wording that works or fails for their context
- **boundary concern** — a concern about scope, independence, or overreach
- **evidence request** — they want to see supporting evidence
- **proof request** — they want a concrete example or proof point
- **referral signal** — they suggested another person or institution
- **no-fit signal** — this is not for them, or not now

## 6. Signal quality levels

- **Level 1 — casual opinion:** an offhand reaction, low context.
- **Level 2 — informed reaction:** a considered view, but not role-specific.
- **Level 3 — role-relevant feedback:** from someone whose role touches the question.
- **Level 4 — decision-context feedback:** tied to a real decision the person owns or influences.
- **Level 5 — repeated pattern across institutions:** the same signal seen from multiple independent
  sources.

Higher levels justify more consequential integration paths. Level 5 patterns are the strongest basis
for canonical change.

## 7. Integration paths

The response to a signal is chosen from this ladder, matched to signal strength (see rubric):

- **no action** — logged, no change
- **parking lot** — held for possible future relevance
- **copy clarification** — small wording clarification in existing material
- **FAQ update** — add or refine an FAQ entry
- **conversation-guide update** — adjust how we frame or answer live
- **adaptation-framework update** — refine institution-type adaptation guidance
- **target-institution brief** — create or update an internal institution readiness brief
- **CLEAR method update** — change the canonical method (high bar)
- **SAGE architecture update** — change the canonical future architecture (high bar)
- **public route/app copy update** — change public-facing copy (reviewed)
- **new evidence/proof asset** — build a supporting evidence or proof artifact

## 8. What not to do

- Do not change canonical architecture from one casual reaction.
- Do not create new public pages from one institution comment.
- Do not create product copy because someone asks "what is the platform?"
- Do not mention SAGE earlier just because someone asks whether this could become software.
- Do not convert feedback into pricing, pilot, demo, procurement, or SOW language.
- Do not weaken human-review, non-scoring, non-automation, or source-system boundaries.

## 9. Required review before changes

Before any change above **copy clarification**:

- The signal must be scored with the signal-classification rubric and meet the path's threshold.
- The boundaries checklist (see the decision-record template) must be confirmed intact.
- The change must be recorded in a feedback-integration decision record.
- Public-copy, CLEAR, and SAGE changes additionally require human review before merge, and must pass
  `pnpm validate:docs`, `pnpm final:go`, and the copy-governance scan.

## 10. Relationship to CIVIC, CLEAR, SAGE, and the adaptation framework

- **CIVIC / CLEAR / SAGE** are the canonical stack. They change rarely and only on strong,
  boundary-safe, repeated signal.
- **The adaptation framework** is the rulebook for institution-specific fit. Most institution-fit and
  language signals resolve here, not in canonical material.
- **This validation layer** sits in front of all of them: it decides whether a reaction becomes a
  change, and if so, at which layer — so external comments become disciplined evidence rather than
  churn.
