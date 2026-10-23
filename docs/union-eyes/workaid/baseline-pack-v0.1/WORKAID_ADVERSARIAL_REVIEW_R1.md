# WorkAid × Union Eyes — Adversarial Review R1

**Review ID:** WA-AR-R1 | **Spec:** 0.1 | **Date:** 23 October 2026  
**Evidence standard:** The reviewer is adversarial to unsupported product claims; an engineering test of source code is not proof of runtime or legal compliance.  
**Overall verdict: FAIL — intentional design hardening stage.** The specification may progress in parallel; no active customer pilot is justified.

## R1 objective

Attack the proposed design from *operations*, *legal/regulatory*, *privacy and security*, *data integrity and integrations*, and *product claims/economics* perspectives. Produce falsifiable negative tests and concrete remedies; no "we will consider" closure. The severity reflects real consequences of shipping incorrectly, not whether code has already been written.

### Challenge model
- Attacker: malicious union staff, compromised member session, improperly scoped WorkAid specialist, rogue service job, untrusted upload, duplicate external event, privileged platform operator, or well-meaning but rushed case worker.
- Target: worker medical and identification files, deadline evidence, representative authority, cross-union data, claim/decision mapping, WSIB/WSIAT legal process, external system consistency.
- Capabilities: direct URL/API calls, stale session, claim IDs known from prior mail, forged org header, replayed submission, parallel workers, deleted docs still in cache, false acknowledgement and malformed scanned documents.
- Defender must work with real UI and API failures, not rely on a clean happy-path demonstration.

## Findings and required disposition

| ID | Sev | Adversarial finding | Required control and closure proof |
|---|---|---|---|
| WA-R1-01 | CRITICAL | **Wrong statutory deadline**: treating all WSIB decisions as six months misses RTW-specific limits or time-limit exceptions | Store issue-specific source and effective date, original letter, human-confirmed deadline, immutable updates, urgent escalation. Run mixed 30-day/six-month and 2025–26 exception fixtures against current WSIB rules. Never autofile. |
| WA-R1-02 | CRITICAL | **Cross-tenant leak by direct object URL or identifier**: same worker may have union A and B histories | Organization-bound authorization on every API, blob, report, search, task and notification. Two-tenant negative test including forged headers, stale role and predictable external claim number. |
| WA-R1-03 | CRITICAL | **Misleading client visibility**: professional documents accidentally become visible to client/union, or lawful worker access is improperly denied | Distinct professional confidentiality, Union Eyes publication permission and external lawful records-access process. Negative tests for metadata, titles, previews, cache, email, search and exports. Confirm privacy/legal design. |
| WA-R1-04 | CRITICAL | **False WSIB receipt**: generating a reminder or recording send as proof of receipt | Distinct `SENT_REPORTED`, `RECEIPT_UNCONFIRMED`, `RECEIVED_CONFIRMED` with actor and method. Fail receipt requirement on merely uploading, generating PDF or email 200. |
| WA-R1-05 | HIGH | **Confused deputy in representation**: an external view grant is mistaken for professional acceptance or authorization | Separate record of WorkAid acceptance, signed authority and technical grant. Revoke one without silently mutating the others; stale sessions denied. |
| WA-R1-06 | HIGH | **Many-to-one case error**: one worker, 3 claims and 5 letters cause missing/incorrect ITO linkage | Claim + decision/issue graph, one-claim ITO grouping, exact letter provenance and counts. Negative tests for wrong claim, duplicate letter, merged issues and closed historical claim. |
| WA-R1-07 | HIGH | **Unreliable notification dispatch**: in-app pop-up fails or queues run twice, so Domenic misses a receipt call | Durable queue, observed delivery, retry/dead-letter, idempotent task genesis, visible undelivered state. Test 2 workers racing, offline browser, push disallowed, restarted worker and duplicate `SENT_REPORTED`. |
| WA-R1-08 | HIGH | **Lost or falsified audit**: intake returns success when document/upload or audit persistence failed | Transactional acceptance, stable request IDs, content hashes, explicit failed states, durability test under injected DB/object-store failure and retry. |
| WA-R1-09 | HIGH | **Authorization overbreadth**: Share Information Release or Medical Authorization interpreted as blanket medical access for a union | Per-purpose, recipient, data-class and expiration grants; signed evidence and revocation; professional approval for publication; no mental-health inference engine. |
| WA-R1-10 | HIGH | **Clio dual-master conflict**: two task desks send conflicting reminders, or duplicated case records expose private notes | Pilot single task-of-record decision; no live connector; integration ledger with idempotency and conflict-handling only in separate phase. Acceptance requires Domenic sign-off of no double entry. |
| WA-R1-11 | HIGH | **Incorrect next-day timing**: Friday or 23:59 upload generates Saturday deadline without Domenic intending it | Define business calendar/local timezone; make due date visible/editable; test weekend, holiday, DST and retry on following day. Unresolved business choice must block *automated due-date defaults*, not manual tasks. |
| WA-R1-12 | HIGH | **Document poisoning and sensitive data in telemetry**: OCR/text extraction leaks claim contents in prompts/logs/search | Antivirus/malware scan, size/type validation, no unrestricted OCR/AI on medical records, tenant-scoped indexing, log redaction; validate with PII canaries. |
| WA-R1-13 | HIGH | **Stale authority after revocation**: expired grants remain effective in stored link, notifications or download URL | Validate active grant on every read, short-lived URLs, revoked token/session tests, invalidate active queue/links. Warn about irrevocable prior downloads. |
| WA-R1-14 | HIGH | **Fake professional timeline**: user sees 'waiting for ARO' or 'appeal filed' when WorkAid has only drafted forms | Event provenance, actor attestations, staged publication approval; cannot publish professional milestone solely from draft file existence. |
| WA-R1-15 | HIGH | **Sensitive institutional aggregates**: Angelo union dashboard leaks claimant health or identifying small-count cohorts across unrelated unions | Minimized metrics, cohort thresholds and per-contract union scoping; export tests including CSV and scheduled reports. |
| WA-R1-16 | MEDIUM | **Intake gate harms urgent cases**: missing photo ID blocks time-sensitive objections | Configurable urgent exception allowing escalation to authorized WorkAid staff without silently declaring referral complete. |
| WA-R1-17 | MEDIUM | **Human-in-the-loop becomes theatre**: 'confirm due date' button can be accepted with no source document | Require named actor, decision/letter link, source rule and manual reasoning when override applied; invalid rule date causes review state. |
| WA-R1-18 | MEDIUM | **Source of truth claims inflated**: 95% missing referrals and 4–6 week wait cited as verified improvement baseline | Mark partner-reported, collect measured pre/post cohort data, preserve denominator and selection bias, no ROI claim before evidence. |
| WA-R1-19 | MEDIUM | **Accessibility blocks distressed or disabled claimants**: tiny controls, legal jargon, one-language notices, unreadable upload failures | Accessible flows, plain-language glossary, progress and support alternatives, screen reader, keyboard, mobile and localization regression checks. |
| WA-R1-20 | HIGH | **Compromised external connector**: future Clio or WSIB interaction replays, changes org context, or delivers wrong case | No connector in v1; future per-tenant OAuth and HMAC/event authentication, idempotency, replay age, rate limit, backfill, reconciliation and disaster recovery. |
| WA-R1-21 | HIGH | **Inaccurate case linkage from identity collision**: two workers same name, one prior member identity or multiple union contexts | Never join by name or claim number alone; verified identity binding, duplicate review, canonical person mapping and explicit human resolution. |
| WA-R1-22 | MEDIUM | **Hidden data leaked through event bus**: notifications and integration events include raw clinical descriptions | Outbound event schemas are purpose-limited and use internal pointers; masked payloads, explicit approved message preview and log-scrub tests. |

## First-pass hardening changes incorporated into v0.1

1. A distinct `WSIBDecision` / `Objection` / `DeadlineObligation` structure replaces naive one-matter-one-appeal assumptions.
2. Outbound dispatch, receipt confirmation and follow-up delivery are separate state machines. "Sent" cannot mean "WSIB received".
3. Professional content, member publication, institutional visibility and statutory worker access are modeled as independent rights/surfaces.
4. Clio remains an external professional authority; no inferred connector, and no automatic mirrored work queue.
5. Deadline derivation requires sourced rules and professional confirmation, with exception histories and explicit date labels.
6. Platform reusable code is specifically bounded by known limitations: grievance-only deadline recipient resolver, demo-only specialist sandbox and unverified staging readiness.

## Review-round protocol (repeat until complete)

| Round | Adversarial lens | What fails the round | Minimum evidence to advance |
|---|---|---|---|
| R1 (this document) | Domain truth, permissions, lifecycle, operational hazards | Any unmodelled catastrophic outcome, dishonest readiness assertion, undefined custody | Corrected v0.1 with open findings registered — **FAIL to release**, suitable for more review |
| R2 | WSIB/WSIAT professional process and deadline law | Wrong form order, authority, ITO count, date rule, exception or clinical-access assumption | Domenic and Angelo process corrections; official source registry and dated examples |
| R3 | Authorization, privacy, abuse, tenant isolation | Any cross-tenant, sensitive document or stale-revocation leak | Executable negative tests and security design threat model; production security state separately verified |
| R4 | Integration, data model, task delivery, recovery | Duplicate send, silent data loss, wrong claim, dual-master task, unreliable reminder | Repository mapping, idempotency/migration plan, contract tests and failure injection on isolated harness |
| R5 | Claimant/union/member UX and accessibility | Incomprehensible progress, unauthorized union view, unusable mobile or assistive tech flow | Moderated synthetic user journeys and accessibility evidence |
| R6 | Economic/operational and deployment challenge | Unsubstantiated benefit, hidden operating cost, wrong rollout promises | Measured pilot baseline/targets, support model and independently proven release candidate |
| R7+ | Unannounced independent challenge / regression | Previously closed finding reopens or new critical finding appears | All issues dispositioned, versioned evidence linked, repeat until no unresolved P0/P1 |

**Round independence:** Each review should start from the specification, the acceptance corpus and the referenced source snapshot, not the prior reviewer's reassuring prose. Every objection receives a stable ID, severity, owner, reproducible attack steps, positive/negative tests and explicit disposition (`FIXED_PROVEN`, `REMAINING`, `ACCEPTED_RISK_SIGNED`, `OUT_OF_SCOPE_BOUNDARY`). A red-team finding is never closed by marking a Markdown checkbox alone. Follow-on R2 findings are recorded separately in `WORKAID_ADVERSARIAL_REVIEW_R2.md`.

## Decision required for R2 start

We do **not** need to block desk research or source-compatible synthetic models on the ten known WorkAid questions. The following require partner confirmation before the live process is frozen: next-day clock rule, task system of record, form/decision grouping, medical disclosure permissions, exception handling, ARO/WSIAT practice and claim identity reconciliation. Source code can be prepared around explicit unknowns rather than making up answers.
