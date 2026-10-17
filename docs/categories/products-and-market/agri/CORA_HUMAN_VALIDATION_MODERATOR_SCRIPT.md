# Cora Human Validation Moderator Script

**Script version:** `cora-round1-moderator-1.0`
**DRAFT FOR AUTHORIZATION - do not use for contact or a session yet.**

Implements the accepted [protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md)
and [session guide](CORA_SYNTHETIC_VALIDATION_SESSION_GUIDE.md).
The [rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md) stays private. All statements
in brackets require approved values/actions; never read an unresolved privacy
placeholder as a promise.

## Pre-session checks (moderator/observer only)

- Separate recruitment/session authorization, approved consent/data policy,
  voluntary consent and independent eligibility checks are on file.
- Reference/version hashes match manifest; no real accounts/data open.
- Participant slot, planned order, accommodation and actual browser recorded.
- Observer has question allocation, manual timer and approved capture location.
- Moderator does not reveal scoring, thresholds, answer key or desired outcome.
- There is no real decision maker, issuer service or connected institution
  operating in this exercise. Do not imply organizational endorsement.

## Welcome, consent and mechanics

> Thank you for considering this research session. We are exploring how people
> understand an early example of an evidence workflow. The example uses invented
> data and is not a deployed service or a real decision about you or anyone else.
>
> We are testing the clarity of the example, not grading your expertise. Please
> give your own interpretation; you do not need to guess what we want to hear.
> Saying that you cannot tell is useful. You can skip a task, take a break or
> stop without giving a reason.
>
> [Read the approved participant information and privacy notice. Confirm written
>
> > notes only, or separately approved optional recording/screenshare choices,
> > access, retention, withdrawal and quote permissions. Obtain affirmative consent
> > before collecting answers. If approval or consent is absent, stop.]
>
> Please do not enter or tell us private farm, financial, customer, certification
> or employer information. No accounts, files or credentials are needed.
>
> As you look around, please say what you are looking for and what you think the
> information means. Use the page yourself in whichever permitted way is
> comfortable. I will not explain the terms until we finish your first answers.
> If something is unclear, say so.
>
> We will pause between blocks. You can request a break at any time. If we
> continue in a second sitting, we will use the same example and keep your
> first answers separate from anything discussed afterwards.

Do not promise "no right or wrong answers" while using a correctness rubric.
The reassurance concerns evaluation of the instrument, not absence of
scoreable meaning. Do not explain Cora's governance model before baseline.

## Task loop

Transition:

> We will now look at example [A-I]. Please review this example.

Read the allocated question verbatim, start task timer after the prompt:

> [Question from bank below.]

Collect participant explanation without substantive follow-up. If mechanics
require clarification, use only the permitted before-lock controls below.
Then:

> How confident are you in that answer: low, medium or high?

Observer locks answer/confidence, task status and timestamp in approved
local capture log. Numeric rubric scoring can occur later; **AFTER_SCORE_ONLY**
means after the first explanation/confidence is locked, not after an answer
is corrected. Never overwrite a locked explanation or improve its score
using a later probe.

Optional after-lock probe:

> What made you think that?
>
> Where did you see that?
>
> What does that phrase mean to you?
>
> Who do you think makes the final decision?

Use the last probe only after the allocated decision-ownership answer is
locked; otherwise it can coach a later baseline. Defer substantive probes
until all baseline questions in the scenario are locked, and preferably
until all baseline scenarios finish. Record probe timing and exposure.

Timeout/break:

> Would you like to continue or skip this task?
>
> Would you like a break or to continue in another sitting?

Offer at 120 active seconds. Record continue/skip and censor only if skipped;
do not stop an ongoing explanation or coerce completion. Pause the timer for
breaks/technical interruptions; missed observations stay null with reason.

## Probe controls

| Class                  | Allowed wording / action                                                                                                                                          | Recording consequence                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `BEFORE_SCORE_ALLOWED` | "You can scroll or use the links yourself." "Would you like the task repeated?" "Would you like a break?" "You may say you cannot tell." Repeat the exact prompt. | Mechanics only; log clarification. Do not point to the answer-bearing section.               |
| `AFTER_SCORE_ONLY`     | The four probes above, requests for own-word terminology explanations, scenario counterfactuals from accepted guide.                                              | Separate follow-up; no change to first-answer score.                                         |
| Never before lock      | "Look under Decision." "Remember Cora does not approve." "Are you sure?" "Why is this not approved?" Define issuer/currentness or confirm correct interpretation. | If used, flag coaching, preserve answer, invalidate affected baseline and trigger QA review. |

If asked about a term before lock:

> Please use your own interpretation for now, or say that you cannot tell. We
> can discuss the term after your first answers.

Do not rescue an incorrect answer. Do not praise a correct answer or
express disappointment. Accessibility mechanics assistance is logged; it is
not substantive assistance unless it supplies the meaning being tested.

## Frozen question bank (private script, not participant handout)

| ID  | Verbatim prompt                                                     |
| --- | ------------------------------------------------------------------- |
| Q01 | What evidence is being used here?                                   |
| Q02 | Where did it come from?                                             |
| Q03 | Who issued or stands behind the assertion?                          |
| Q04 | What did Cora do with it?                                           |
| Q05 | What requirement is being checked?                                  |
| Q06 | Who owns that requirement?                                          |
| Q07 | What did the technical check establish?                             |
| Q08 | Is the operator approved here? What supports your answer?           |
| Q09 | Who makes the institutional decision?                               |
| Q10 | Is this evidence current? How do you know?                          |
| Q11 | What remains unknown or unresolved here?                            |
| Q12 | Could this evidence be used elsewhere? What would you need to know? |
| Q13 | Was evidence actually reused in this workflow? Explain.             |
| Q14 | What changed when permission was revoked?                           |
| Q15 | What remains historical here, and what can you do with it now?      |
| Q16 | What does the disagreement mean? Who would resolve it?              |
| Q17 | Which workflow would you follow next, and why?                      |
| Q18 | What does this view permit you to do with the evidence now?         |
| Q19 | What would another institution still need to decide for itself?     |
| Q20 | Why did this attempt not qualify as evidence reuse?                 |

Allocation is unchanged: S1 Q01-Q13/Q18; S2 Q05-Q13/Q18/Q19;
S3 Q07-Q10/Q14/Q15/Q18; S4 Q07-Q10/Q15/Q17;
S5 Q02-Q04/Q07-Q09/Q11/Q16; S6 Q01/Q05/Q08/Q11/Q18;
S7 Q07/Q08/Q12/Q13/Q20; S8 Q10/Q11; S9 Q07/Q10/Q15.
Use A-I labels, actual counterbalanced order from manifest and all 61 tasks.
Do not give another entry's evidence as the answer to denied S6.
For S4, let the participant follow the actual authorized successor.

## Terminology review, debrief and close

Only after all baseline answers, including a staged second sitting, are locked:

> Which words were difficult or unclear? What do "technical match," "issuer,"
> "requirement owner," "recipient," "currentness," "reuse," "historical,"
> "revoked" and "superseded" mean to you in these examples?
>
> What would you change to make the explanation clearer?

Capture exact language separately; no extra denominator points.

Debrief (do not read before baseline):

> Thank you. These examples separate source information, technical checks,
> permissions and decisions. A technical match is not approval. The recipient
> owns its decision, and another recipient must decide independently. History
> and revoked access are not current permission, and displaying a conflict
> does not resolve it. All material here was invented; no real decision or
> source access occurred.
>
> [Repeat approved withdrawal contact/method, cutoff, recording and quote
>
> > choices, without promising unapproved retention/deletion terms.]
>
> Your explanations will help identify wording and navigation problems in the
> concept. They are not an endorsement. Thank you for your time.

No feedback correction rescues baseline scores. Observer closes logs, notes
any burden/accessibility issues and hands pseudonymous evidence to authorized
independent reviewers. Do not send thanks or follow-up until explicitly authorized.
