# CUPE National Demo Boundary Register

## Demonstrate

| Segment | Objective and scenario | User role / data / screens | Evidence and disclaimer | Exit condition |
|---|---|---|---|---|
| 1. Context and boundary (5 min) | Establish that Union Eyes is being shown as a constrained pilot workflow, not a National production commitment. Ask how CUPE separates local, regional and National authority. | Facilitator; synthetic, non-sensitive seeded records; opening/dashboard | `tests/api/rbac.spec.ts`, capability inventory. State that only pilot-critical paths are in scope. | President confirms the operating question to explore. |
| 2. Intake to assignment (10 min) | Show a representative member issue being captured, assigned and placed in a work queue. | Member/steward; seeded test case; intake and workbench surfaces | Case/intake/assignment tests and route inventory. Do not present as full grievance lifecycle coverage. | A case is assigned in the seeded organization. |
| 3. Controlled workflow and evidence (10 min) | Show permitted transition, timeline/audit history, and approved seeded attachment/evidence record. | Steward; seeded non-sensitive attachment; case detail/timeline | Workflow/evidence tests; CUPE checklist Phase 2-4. State privilege, legal hold and redaction are not demonstrated. | Timeline displays the audited demo activity. |
| 4. Boundary proof (5 min) | Show an attempted direct request with a wrong-org seeded persona being denied, or show recorded test evidence if live test tooling is unavailable. | Technical presenter; seeded secondary-org persona | `tests/e2e/org-isolation-negative.spec.ts`. This proves selected pilot paths only. | Audience understands local ownership evidence is bounded. |
| 5. Pilot operational view (5-10 min) | Show pilot dashboard/workbench metrics and a representative export using synthetic records. | Admin; synthetic seeded records; dashboard/export | Dashboard/export test references. State metric definitions and National aggregation need validation. | No record-level National visibility claim is made. |
| 6. AI boundary (5 min) | Explain the opt-in guard, human-review output and data-flow decision gate; do not submit CUPE information. | Facilitator; static code/evidence, no sensitive prompt | `app/api/ai/summarize/route.ts`. | AI is positioned as optional drafting/support only. |

## Discuss without demonstrating

- CUPE hierarchy configuration after discovery of regions, sectors, departments, locals and delegated authorities.
- Aggregate National intelligence with a formally agreed record-level access policy.
- Entra/M365 and legacy-system integration after interface, identity and records-of-authority discovery.
- A continuity/coordination-layer deployment that leaves established CUPE systems of record in place.
- A phased pilot implementation, subject to data, privacy, legal, accessibility, scale and operating-model validation.

## Acknowledge as incomplete

- Cross-structure matter transfer, consultation, joint ownership, escalation acceptance and returns.
- Privileged/sensitive matter controls, legal hold, retention, disposal, redaction and records-management lifecycle.
- English/French operational parity and accessibility conformance.
- Migration, National reporting definitions, performance/capacity validation, DR/incident exercises and production support.

## Explicitly exclude

- Live CUPE personal, grievance, health, legal, bargaining, strike, campaign, financial or privileged information.
- Claims of matter-level privilege, complete National-local authorization, legal compliance, residency compliance, security certification, National scale, migration readiness, M365 integration or production readiness.
- Any AI prompt containing CUPE confidential information and any implication that AI recommends or decides an outcome.

## Stakeholder challenge bank

Each answer is evidence-backed by the matrix and audit evidence register. “Demo” means live demonstration is permitted only under the boundary above.

| Stakeholder | Likely difficult questions (ten) | Answer posture / demo |
|---|---|---|
| President | 1. Can National see every grievance? 2. Can locals keep ownership? 3. Can we see trends only? 4. Can it survive leadership turnover? 5. Does it work in French? 6. Can it start as coordination only? 7. Can it scale nationally? 8. What does a pilot take? 9. Can it replace current tools? 10. What cannot it do? | A1/B1/E2/I1/L1/P1/Q1/R1/U1/U2. Show only seeded pilot intake-to-audit and boundary proof; qualify all National claims. |
| Senior officer | 1. Who authorizes National access? 2. Can a local refuse sharing? 3. Can a file transfer? 4. Can we audit decisions? 5. Can we delegate? 6. Can we export? 7. Is reporting reliable? 8. Can committees act? 9. Can senior roles be restricted? 10. Can we reverse access? | B2/B3/C4/J1/G3/K1/K2/A1/F1. Do not live-demonstrate unproven authority/privilege paths. |
| Servicing representative | 1. Intake? 2. assignment? 3. reassignment? 4. deadlines? 5. notes? 6. evidence? 7. escalation? 8. appeal? 9. temporary cover? 10. offline/outage? | C1/C2/H1/D1/C3/D2/S2. Demonstrate only tested seeded workflow; acknowledge remainder. |
| Privacy/legal | 1. Residency? 2. privileged files? 3. health/harassment data? 4. AI data flow? 5. legal hold? 6. retention? 7. audit retention? 8. break glass? 9. breach response? 10. vendors? | S1/F1/F2/T1/H2/G3/S2. Demonstrate no sensitive data; require PIA/DPIA and legal review. |
| IT leader | 1. Entra? 2. M365? 3. APIs? 4. integration architecture? 5. monitoring? 6. restore? 7. rate limits? 8. SSO lifecycle? 9. scale? 10. security testing? | P1/S1/S2/R1/G1/G3. Discuss existing primitives only; no integration or scale demo. |
| Regional representative | 1. Regional boundary? 2. escalation? 3. local ownership? 4. shared work? 5. temporary assignment? 6. trend view? 7. regional reporting? 8. French? 9. committee work? 10. reorganization? | B1/B3/D1/D2/C2/E1/L1/A1/I1. Demonstrate pilot only. |
| Skeptical local leader | 1. Can National read my files? 2. Can I control sharing? 3. Is this surveillance? 4. Who changes roles? 5. Can it work with our system? 6. Can data leave? 7. Can we leave? 8. Can we export? 9. Is it bilingual/accessibile? 10. What happens if it fails? | B1/B2/B3/G3/P1/S1/U2/K1/L1/M1/S2. Be explicit that these protections require CUPE-specific proof before adoption. |

## Live-demo survival rule

The product is suitable for a live session only when the presenter uses fixed synthetic seed data, pre-provisioned pilot personas, tested routes, and a fallback to recorded test evidence. A polished UI must never be used to imply untested backend enforcement or data boundaries.
