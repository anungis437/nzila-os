# Cora Synthetic Validation Session Guide

**Design only.** No participants have been contacted or tested. Use this guide
only after separate authorization for individual research logistics.

## Before a future authorized session

1. Register [protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md) version,
   role, counterbalanced order, frozen question list and proposed thresholds.
2. Pin SHA-256 of the existing local synthetic HTML and note browser, viewport,
   language, access needs, previous Cora exposure and gallery-title cue exposure.
   Do not regenerate/change the UI mid-round or use real files/accounts.
3. Assign pseudonymous session ID; keep names/contact information outside the
   repository. Record voluntary participation/withdrawal arrangements and
   approved local capture location/access/retention/deletion policy. If these
   are unapproved, do not conduct or persist a human session.
4. Moderator keeps [rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md) private;
   observer prepares [capture format](CORA_HUMAN_VALIDATION_CAPTURE_SCHEMA.md)
   and manual stopwatch. No production telemetry or server is needed.
5. Check local file renders, links/disclosures work and no extra data is present.
   Provide requested assistive technology; unmet needs are a study limitation,
   not participant failure. Full screen-reader conformance remains unproven.

## Opening script

> This is a local example with invented data. We are testing whether the
> information is understandable, not testing your expertise. Please explain
> what the page means to you. You can say that you do not know, skip a question,
> take a break or stop. Please do not enter personal, farm or employer data.

Do not teach "match is not approval," define issuer, describe correct rights
or recite the constitutional model before answers. Visible UI warnings remain
part of the stimulus. Do not praise correctness or signal errors.

## Task cycle

1. Navigate to assigned entry using label A-I. Do not name its outcome.
2. Read the assigned question verbatim from the private bank. Observer starts
   task timer after the prompt; log any interruption.
3. Observe locations, expansion events, backtracking, requests for definitions
   and stated evidence. Do not point to the relevant section.
4. Ask: "Please explain what that means in your own words."
5. Ask after **each** answer: "How confident are you: low, medium or high?"
6. Lock first answer and confidence. Then optionally ask: "What on the page
   led you to that interpretation?" or "What, if anything, can you not tell?"
   Capture follow-up separately; do not rescore baseline.
7. At 120 active seconds offer: "Would you like to continue or skip this task?"
   If skipped, retain censored timing and response status. A break stops the
   timer; missed timing is null with reason.

If asked for a definition: "What do you understand that word to mean here?"
If asked for confirmation: "Please tell me your interpretation of the page."
Do not say "look under Decision," "are you sure?", "remember that..." or
"why is this not approved?" Such prompts teach or lead the answer.

## Scenario tasks and probes

| Label  | Neutral introduction                                               | Probe after locked explanation                                                |
| ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| A / S1 | Review this workflow and explain its meaning.                      | What next action, if any, would be justified by this page?                    |
| B / S2 | Review this other workflow using the same process.                 | What would need to change before you could say the requirement was fully met? |
| C / S3 | Explain what this record says about action now and about the past. | What on the page supports each part of your explanation?                      |
| D / S4 | Explain how you would continue from this record.                   | What changed when you followed the link, and what did not?                    |
| E / S5 | Explain the assertions and their implications here.                | What next process or person would you expect to be involved?                  |
| F / S6 | Explain what this screen lets you know.                            | What cannot be established from this screen alone?                            |
| G / S7 | Explain the attempted use of evidence in this workflow.            | What supports your explanation of that attempt?                               |
| H / S8 | Explain how you would treat this evidence today.                   | What on the page supports that treatment?                                     |
| I / S9 | Explain the timing and technical result in this record.            | What is a past result versus a statement about now?                           |

Never infer the exact hidden cause for F or reveal the denied fixture's
underlying evidence. For D follow the actual authorized successor; if no target
exists in the pinned reference, stop that task and report `UX_VALIDATION_BLOCKER`,
not an invented successor.

The gallery labels cue outcomes; record reliance on labels versus supporting
explanation. For F do not let participants search another gallery entry as
proof of the withheld record's details. Log unintended navigation without
concealing the original attempt.

## Terminology and navigation observations

After scored questions, ask what each term means in the participant's words:
technical match, issuer, requirement owner, recipient, currentness, reuse,
historical, revoked and superseded. Use the visible term in context; do not
propose a replacement phrase first. Capture the participant's phrase exactly,
whether it caused an incorrect interpretation and any suggested wording.
These late term probes are qualitative findings, not extra numerator points.

Find tasks measure source, issuer, requirement owner, decision owner,
freshness and reuse using the per-question stopwatch protocol. Record section
name and text landmark; missed metrics remain unknown. Navigation across
multiple equivalent paths is not a failure by itself.

## End and review

Only after all baseline answers are locked, debrief misconceptions neutrally
using invented examples and remind participants no real approval/access
decision occurred. Do not include the debrief in the scored dataset.

Observer exports authorized pseudonymous capture to the approved local
research location, not source control. Analysts independently score/adjudicate
critical/high findings and preserve first answers, prompts and disagreements.
Research owner reports denominators, incomplete sessions, confidently wrong
answers, role/scenario results and retest needs. No claimed participation,
acceptance or comprehension result can originate from the analyst dry run.

## Analyst-only rehearsal checklist

- All four role lenses and all seven core scenarios accounted for.
- Both stale and expired probes included; successor inspected separately.
- Twenty-question bank, 61 planned responses, all guardrail mappings explicit.
- Denial key accepts lack of information; no leaking guessed identities.
- No leading intro, definitions or score-improving follow-up.
- Stopwatch pause/missing/censor semantics and confidence separate.
- Critical flag veto survives high totals; null rows cannot improve pass rates.
- Findings have evidence, severity, adjustment recommendation and retest rule.

The [dry-run fixture](CORA_HUMAN_VALIDATION_DRY_RUN.json) exercises design
coverage and adverse capture cases only. It is not an authorized human session.
