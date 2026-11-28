# CIU clause crosswalk — batch 02
2026-11-28. Baseline 7e45edc5c877a31ee0a0efd61236e6ee395b5255. Extends CIU_PRE_INTRODUCTION_QUALIFICATION.md. Evidence is public source inspection and indexed code search, not runtime qualification.

## Source census
Official precedence index https://ciu-sdi.ca/en/rules-regulations/ and FR https://ciu-sdi.ca/a-propos/publications/regles-et-reglements/ verified. English governance PDFs retrieved: bylaws 25p, regulations 42p, branch rules 32p, local amendments 19p, election kit 11p (129 pages total). Partial clause inspection, not full review. Election kit https://ciu-sdi.ca/wp-content/uploads/elections/2026/2026-elections_kit_en.pdf. Agreement index https://ciu-sdi.ca/en/collective-agreements/ lists all five. TBS HTML endpoints reject retrieval. EB (311p), FB (214p), TC (297p) CIU-hosted PDFs retrieved; PA/SV PDF retrieval exceeds tool size cap. FR agreement texts and complete PSAC constitution/regulations clause review remain. Published expiry is not proof of applicability. Validate supersession, statutory continuation, memoranda and both language versions before freeze.
Sources: https://www.ciu-sdi.ca/wp-content/uploads/documents/CA-FB-EN.pdf (Article 18, PDF pp24–31); https://www.ciu-sdi.ca/wp-content/uploads/documents/CA-TC-EN.pdf (Article 18, PDF pp28–35); https://www.ciu-sdi.ca/wp-content/uploads/documents/CA-EB-EN.pdf (TOC Article 37); https://ciu-sdi.ca/en/standard-operating-procedures-on-grievance-handling/; https://ciu-sdi.ca/en/workforce-adjustment/; https://ciu-sdi.ca/en/guides-and-reference-material/job-classification-review-faq/.

## Atomic acceptance requirements
Each row requires source version, canonical capability ID, owning test, positive and denial evidence, environment and SHA. All runtime states NOT_EXECUTED. Source references below are pointers, not an exhaustive legal ruleset.
ID | Source | Acceptance assertion
---|---|---
GOV-01 | BL1–2 | Component and branch boundaries independent of access grants; preserve leading zero external branch codes.
GOV-02 | BL2.3 | Jurisdiction dispute goes to National Executive with appeal to Board and Convention; no silent transfer.
GOV-03 | BL3.1 | Versioned authorized interpretation, subsequent reversal preserves earlier decisions.
GOV-04 | BL5.2–10 | Branch membership, card evidence, democratic rights, representative and bargaining authority distinct.
GOV-05 | BL5.4 | Recognition categories and dues exception distinct from active voting rights; secret award vote with applicable threshold.
GOV-06 | BL6 | Separate confidential membership discipline and appeal workflow, not employer grievance.
GOV-07 | BL7 | Dues, waiver, parent-to-component-to-branch reconciliation and subsidy.
GOV-08 | BL8–9 | Convention credentials, alternates, committees, quorum, resolutions; special meeting scope.
GOV-09 | BL10 | Eligibility, nominations, vacancies, office succession, oath and outgoing authority revocation.
GOV-10 | BL11–13 | National executive and board distinct responsibilities; equity mandates and review.
GOV-11 | BL14–15; Reg14–15 | Governed expenses, finance statements, auditor scope, disbursement and retention.
GOV-12 | BL16–20 | Communications, referendum, amendment, oath, national president compensation; no assumed live voting/finance.
GOV-13 | Reg3 | Committee mandates, chairs, term, vacancy, expenses and delegated powers.
GOV-14 | Reg6 | Explicit signing delegation on grievance; no role-based implicit authority.
GOV-15 | Reg7 | Release-from-duty request and evidence under applicable policy.
GOV-16 | Reg11; BR14 | Trusteeship temporary authority, preservation of historical mandates, review and restoration.
GOV-17 | BR9–10,16; amendments | Branch-specific executive and steward configuration, Sarnia example; no bespoke fork.
GOV-18 | BR11; amendments | Branch-specific quorum, motions, notice and meeting scopes.
GOV-19 | BR12; 2026 kit p3 | Electronic OR permitted paper method; disallow mixing within election; local timezone, acclamation, appeal and tie windows.
GOV-20 | BR13; Hamilton amendment | Temporary excluded management appointment suspends authority as applicable; reinstatement controlled.
REP-01 | FB18.03 | Written group consent per person; reject missing consent, allow compliant alternate form.
REP-02 | FB18.04 | Policy grievance direct final level; employer-originated path distinct; CIU SOP dual presidential approval.
REP-03 | FB18.07; TC18.07 | Qualifying informal discussions pause elapsed calculation with evidence and bounded start/end.
REP-04 | FB18.08–09 | Employer receipt and alternate form accepted; preserve source identifier.
REP-05 | FB18.11; TC18.11 | FB ordinary three levels versus TC maximum four with permitted intermediate waiver; agreement-specific transitions, no universal skip rule.
REP-06 | FB18.15; TC18.15 | 25 days from notification/awareness, not necessarily incident.
REP-07 | FB18.16(a); TC18.16(a) | Escalation within ten days of written decision conveyed.
REP-08 | FB18.16(b); TC18.16(b) | Non-response escalation limit fifteen days from prior presentation, distinct from ten-day normal reply.
REP-09 | FB18.17; TC18.17 | Normal reply ten intermediate, twenty final, thirty policy; separate clocks from member escalation.
REP-10 | FB18.20; TC18.20 | Exclude Saturday/Sunday/designated paid holidays; calendar version and source.
REP-11 | FB18.21; TC18.21 | Mail postmark vs delivery vs receipt trigger distinguished.
REP-12 | FB18.22; TC18.22 | Mutual extension and applicable Alliance participation recorded.
REP-13 | FB18.23–24; TC18.23–24 | Governed level elimination and qualifying demotion/termination direct final level.
REP-14 | FB18.25–26; TC18.25–26 | Written abandonment, missed escalation and beyond-control exception; no automatic irreversible closure.
REP-15 | FB18.27–28; TC18.27–28 | Adjudicability and Alliance approval/representation where required; no universal referral.
REP-16 | CIU SOP final level | Executive signature, full handoff packet, national LRO restricted grant and receipt.
REP-17 | CIU SOP discipline | Restricted PSI and medical evidence, classification and redacted export.
REP-18 | CIU classification FAQ | Statutory classification and statement-of-duties pathways distinct from ordinary agreement grievance.
REP-19 | WFA index | EB B / FB C / PA D / SV I / TC T appendix mapping; dated cohort and option decisions.

## Crosswalk and residuals
F01 integration facade: indexed searches for processInboundCase and UeIntegrationFabric at baseline returned only implementation, unit test and integration-playbook. Playbook places database insertion downstream; inspected method links with empty internalId and returns generated UUID and success. No production consumer found in indexed results; require exhaustive local rg/import graph before final reachability classification. P0 qualification, no app-wide claim.
F02 full-fidelity case migration: current grievance-import-service.ts has normalized input, fingerprint and transactional audit; trace other import routes before deciding implementation. Historical stage/document/approval/deadline preservation not proven.
F03 deadline calculation: Django serializers expose business_days_only, days_from_event, extension/approval flags; scheduler requires pre-expanded business-day offsets. Model/serializer fields are not rule execution. Require actual end-to-end calculation and persistence for REP-03/06–13. No universal fallback.
F04 policy hierarchy: organization schema and authority kernel provide basis; institution-specific policy inheritance, trusteeship and local branch variation not established. Route existing authorities rather than duplicate.
F07 elections: branch kit verifies electronic default with paper alternative, not mixed; live voting restrictions preserved. Need external result ingestion certification, appeal and succession.
 
## Execution contract for next engineering batch
Trace existing capability IDs and complete callers for F01–F07 on current main (record SHA), identify owning Step 2 tasks, run focused tests before fixes; add failing-before evidence for confirmed defects. Use isolated databases and synthetic organizations; no live mandates or external connection. Reconcile all public sources including FR, PA/SV, PSAC and amendments before marking CIU-00 frozen. No runtime evidence, no release flag movement, no client contact.
