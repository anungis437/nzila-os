# WorkAid × Union Eyes — Adversarial Review R2: WSIB/WSIAT Procedure

**Date:** 23 October 2026 | **Reviewer lens:** Official procedural correctness vs WorkAid's observed custom workflow.  
**Verdict:** **FAIL for procedural freeze / pilot**, **PASS to continue evidence-driven preparation**.  
**Method:** Independent cross-check of Domenic's 21 October operational note and official WSIB ITO instructions, appeals practice guidance and WSIAT Notice of Appeal practice directions. Public regulator guidance does not replace current individualized legal advice or WorkAid validation.

## Nine additional findings

| Finding | Priority | Attack / contradiction | Product correction & acceptance proof |
|---|---|---|---|
| WA-R2-01 | P0 | WorkAid asks for **all historical claim numbers**, but WSIB ITO instructions say **do not include claim numbers for injuries with another employer** in certain optional reasons. Blindly auto-populating prior claims from intake into a submitted ITO may disclose unrelated claims. | Separate private background history from *form-specific permitted disclosure*. Default never copy cross-employer numbers to ITO; add WA-T071/072; WorkAid confirms legitimate same-employer references. |
| WA-R2-02 | P0 | "One ITO per denial letter" is Domenic's practice, but WSIB instructions explicitly require ITOs under **each separate claim number** and allow multiple disputed issues in a single decision letter. A rule that generates one ITO per letter may over/under-file. | Preserve claim/decision/issue graph and an ITO-to-issues linking table. Treat count per claim/letter as a WorkAid professional choice; test both paths (WA-T073). |
| WA-R2-03 | P0 | Treating every WSIB decision as one uniform deadline is wrong; the WSIB website describes return-to-work categories, other decisions, mixed-issue treatment and documented extraordinary extension windows in 2024–26. | Rule source registry with effective periods and named reviewer. Manual rule affirmation on abnormal cases. WA-T074/075. Never automatically declare "deadline met". |
| WA-R2-04 | P1 | Pressure to wait for a complete evidence packet might delay ITO beyond a statutory limit. WSIB instructions warn **not to delay an ITO while awaiting new evidence**. | Emergency exception moves to authorized filing preparation despite incomplete referral; missing proof remains tracked. WA-T076. |
| WA-R2-05 | P1 | WSIB DOA is representative authorization, not an appeal or file request; four WorkAid onboarding forms are distinct from DOA. | Separate types and consent authority. No false equivalence or substituted paperwork. WA-T077. |
| WA-R2-06 | P1 | WSIB ARF follows the objection/file process and can include structured submission. Treating ARF as a generic form always available at initial intake is misleading. | Stage it after applicable WSIB response, validate form/version and WorkAid intended workflow. WA-T078. |
| WA-R2-07 | P1 | WSIAT NOA is not the WSIB ARF. Official WSIAT guidance references separate worker NOA and requires a final WSIB decision copy; worker-appellant must sign a disclosure-related section. | Distinct Tribunal appeal entity, NOA checklist with professional reviewer and current form; never autofile. WA-T079. |
| WA-R2-08 | P1 | A WSIAT process may include **Confirmation of Appeal (COA)** and subsequent procedural correspondence rather than ending at NOA. | Include Tribunal confirmation/hearing readiness as a distinct optional, rule-versioned state; Angelo validates actual practice. WA-T080. |
| WA-R2-09 | P1 | Claimed 4–6 week WSIB turnaround is an observed WorkAid service experience, not a legal filing or receipt deadline. | Separate service expectation, statutory obligation and internal follow-up; report empirical baseline transparently. WA-T031 remains unexecuted. |

## Official evidence reviewed

- WSIB ITO instructions: https://www.wsib.ca/sites/default/files/2024-09/2394a_202407_itoworkerinstructionsheet_web.pdf — multiple entitlement issues in one decision letter, one ITO per contested claim, cross-employer privacy caution, recommendation not to wait for evidence.
- WSIB Appeals Practices and Procedures: https://www.wsib.ca/en/appeals-practices-and-procedures — 30-day/six-month time-limit rules, mixed-issue treatment, historical extension conditions including 60-day additions for specified 2024/2025/2026 decision windows.
- WSIB worker forms: https://www.wsib.ca/en/forms — DOA, worker file request and ITO are distinct.
- WSIAT Practice Directions: https://wsiat.on.ca/en/print/pd/pdAllEnglish.pdf — Notice of Appeal, final decision attachment, worker-appellant disclosure signature, six-month general NOA period, and COA stage; validity/version needs fresh confirmation before production use.

## Revised negative tests

- WA-T071: Old claim under different employer remains visible privately to authorized WorkAid reviewer but is not injected into WSIB ITO reasons.
- WA-T072: Authorized same-employer related claim references require work-context validation, not just matching names.
- WA-T073: Two letters, one claim; two claims, one member. Different form groupings reviewed, no automatic one-letter-to-one-ITO assumption.
- WA-T074: Mixed issue deadline uses documented exception handling and human confirmation.
- WA-T075: 2024–26 disruption windows demand source-specific review; no generic extension for all dates.
- WA-T076: Incomplete medical evidence doesn't force delay of urgent professional objection action.
- WA-T077: Four WorkAid intake documents cannot substitute for WSIB DOA.
- WA-T078: ARF form step may require WSIB-provided packet; system never asserts missing stage is complete.
- WA-T079: WSIAT NOA asks for final decision and professional confirmation of worker signature requirements.
- WA-T080: COA/hearing-ready procedure tracked separately from original NOA; no invariant 24-month deadline without professional confirmation of current practice.

## Closure ledger and readiness

**Design fixes incorporated:** DA-1 separate historical claims vs external submission disclosures; DA-2 ITO object linkage by claim/decision/issue; DA-3 rules/exception registry + human validation; DA-4 urgent objection route; DA-5 Tribunal NOA/COA separate.  
**Not closed:** WA-R2-01 through WA-R2-09 remain **OPEN_FOR_EXECUTABLE_PROOF**, and several need WorkAid confirmation of actual business process, form version and disclosure basis.  
**Next independent attack:** R3 — attempt to extract restricted content through union dashboards, search, document previews, notification payloads, logs and revoked access paths. All tests must be coupled to current tenant-isolation runtime evidence; no staging or real-data execution here.
