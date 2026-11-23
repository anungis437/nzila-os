# Union Eyes V2 base-release remaining work

The accepted staging record proves the named casework and access journeys on application `241006d302c14567e541d619675fbead3ec3f258`. It is not a statement that every capability in the application is implemented, or that production readiness has been signed off. This review uses repository snapshot `7753084d79c9db310bc483b87ade0de76415cd7e`, whose Union Eyes application tree is unchanged from that accepted source.

Some earlier defect remediation removed misleading controls or changed false success into an honest unavailable response. Those changes repaired the false behavior while leaving the capability unavailable. A source-remediation count is not a count of implemented features.

## November 23 current execution delta

The full persona scope is **35 stakeholder families: 26 required and 9 deferred**, with **39 stored roles: 34 required boundaries and 5 deprecated/excluded values**. It also includes 16 required lifecycle stages, four operating models and six variants. The seven navigation profiles are a subset only. The [source-bound census](evidence/ue-v2-forward-upgrade-20261122/persona-and-lifecycle-census.json) joins this scope to the existing 22 functional and 13 required operational families; none becomes accepted through a navigation pass.

Application `aa545415cfe4b172733000cfc6510712d4de0cba` has qualified source and an immutable image, but its actual staging revision is unhealthy at zero traffic. The previous `cccfc8c311` revision remains healthy at 100%. [Preparation run 45093129058](https://github.com/anungis437/nzila-os/actions/runs/45093129058) failed its readiness check. [Transactional rehearsal 45093321513](https://github.com/anungis437/nzila-os/actions/runs/45093321513) also failed; its owned job and secret were removed and no apply was launched. Its failure is not a verified rollback proof. Actual loopback readiness identifies catalogue admission as the blocker while database connectivity, storage, scanner and decision proof pass.

The [read-only failure diagnosis](evidence/ue-v2-forward-upgrade-20261122/actual-managed-admin-refusal.json) found that the existing managed database administrator has BYPASSRLS, whereas the operator and its disposable fixture required NOBYPASSRLS. Both application principals remain unprivileged. The current repair must prove both pre-existing administrator profiles, preserve the original attributes and data, and obtain a new successful live rehearsal before apply. Neither this diagnosis nor prior CI establishes base-release staging acceptance. Finance implementation and production deployment remain excluded.

The administrator-profile repair was admitted through [PR #1282](https://github.com/anungis437/nzila-os/pull/1282), with five local checks and 19 required CI contexts passed. Its [new live rehearsal 45101930240](https://github.com/anungis437/nzila-os/actions/runs/45101930240) reached function replacement and refused PostgreSQL `42501`: four messaging/triage guards still have their original administrator owner. The [complete ownership-family diagnosis](evidence/ue-v2-forward-upgrade-20261122/actual-function-owner-refusal.json) records all four transitions. An independent read-only capture after failure exactly matches all 26,449 original baseline-query catalogue objects, byte for byte. The owned job and secret were removed; no apply was launched. The new source repair must qualify the bounded owner handoff and a disposable fixture that reproduces the entire family. Failed rehearsal status is retained; the catalogue comparison is not a successful full rehearsal or a business-row readback.

The ownership repair was normally merged in [PR #1283](https://github.com/anungis437/nzila-os/pull/1283), with its five local commands and 19 required CI contexts passed. Its [new live rehearsal 45108741981](https://github.com/anungis437/nzila-os/actions/runs/45108741981) failed a managed-catalogue assertion. [Read-only evidence](evidence/ue-v2-forward-upgrade-20261122/actual-managed-catalog-refusal.json) exactly matches all 26,449 original catalogue objects after rollback; cleanup succeeded and no apply was launched. A saved-metadata counterexample identifies an owner-only sequence ACL representation that the operator leaves unchanged but rejects during qualification. The repair recognizes only the exact PostgreSQL default permission equivalence and expands the native preimage fixture; final-source qualification and another successful live rehearsal remain required.

The older dated sections below retain their original candidate scope and are historical evidence.

## November 16 runtime qualification delta

Observed staging is application `7d939bf5399ef768cc71a837730a6ff143d079d1`, workflow `5fae54b471e84d73eab5e44d723aee12a0add797`, build `43870172495`, deployment `43875150222`. Proposed repair source is `41dba402dd53fec280091f11f46a99077dd91465`. Its binding and deployed qualification remain pending. Full base release is **STAGING_NO_GO**; the historical accepted F record has its original narrower scope.

[Actual prior-candidate observations](evidence/ue-v2-runtime-repairs-41dba402/observed-prior-candidate-delta.json) prove the fresh controlled invitation receipt, acceptance, dashboard and first case; durable identity, membership, case and creation audit have independent readback. Reopening remains recipient-attested. Both controlled accounts and their cases are preserved. The recipient also confirmed the Azure test alert; continuous detection and recovery remain unproven.

Six persona roles passed on the observed source. Chief Steward mobile workbench navigation failed its page-load limit; all temporary access was restored. Real automatic claim matching, balancing, capacity contention and assignment audits have partial positive proof, but the mandatory signed-in case-read workload failed both declared stages. Formal automatic matching and same-cookie post-retirement HTTP denials were not reached. The proposed repair reduces repeated authentication work and fixes actual PDF parser and OCR transaction-lifetime defects; local component tests do not establish deployed remediation.

The base-release work still required is:

- Admit, build and qualify the exact repair; repeat unchanged authenticated workload, all seven personas, paired access, base journeys and worker scenarios.
- Finish invitation error/reissue/revoke/duplicate/MFA and membership lifecycle matrices, plus persistent setup write/reload/refusal/audit checks. Observed T2 invitation acceptance has hard-coded English text and an English dashboard redirect. The proposed source repairs both and retains language through MFA; its actual bilingual first-use and boundary qualification remain pending.
- Complete connected intake, triage, automatic claim/formal assignment, investigation, transition, closure, successor handoff, member follow-through and permitted senior oversight.
- Exercise document upload, search, download, version binding, real image/PDF extraction, distinct-principal human review, self-review/stale-edit refusal, purpose-controlled publication and user-facing sealed export.
- Qualify correspondence approval/dispatch, enabled staff messaging/preferences/read state, accurate leadership counts/drill-down and organization access removal. The serving staging environment also lacks the required case evidence HMAC key reference. This binding adds a staging-only dedicated secret reference and named-secret access; compiled/local preflight proof does not establish an actual sealed export.
- Connect staff-managed deadlines to member/workbench/handoff views and prove formal reminder receipt in a controlled inbox. Automatic legal-date calculation and intake reminder email remain disclosed separate limits.
- Qualify the implemented in-app privacy self-service (explicit founder requirement). Continuous backup/audit/worker/dependency freshness, alert recovery, enabled bilingual states and declared accessibility checks remain unfinished; reconcile the action ledger against actual proofs.

Finance/dues persistence and Financial Officer 2.1 stay excluded. Full-traffic failover, physical-device certification and operating cadence retain their separately declared scope. The founder explicitly extended the same CHG-2026-0114 staging scope through `2026-11-17T03:00:00Z` (10 p.m. Toronto on November 16); production deployment remains excluded.

## November 16 earlier source-S execution


Staging now serves application `78301eecc968ff3a21b602a9c9307c50f73cd5f8`, workflow `17099dc87643e5206c931285cfaefc377261fd79`, build `43825322999` and deployment `43830579236`. The historical accepted F17-criterion record remains historical; full base-release staging acceptance is unfinished. [Actual source-S observations](evidence/ue-v2-document-review-20261116/source-78301eec-action-observations.json) record six real worker scenarios plus exact fixture retirement, and fresh read-only preservation of the controlled invited member and original case/audit.

Actual administrator profile saving/readback and expertise refusal passed, but matching execution exposed two more defects: the long representative selector is clipped on a phone, and the general executive menu guard redirects an actor who has explicit case authority away from the workbench. The follow-up fixes both, and includes the missing transcript review/publication controls. [Local validation](evidence/ue-v2-document-review-20261116/base-ui-local-validation.json) is separate from deployed qualification. Failed runs and cleanup receipts are retained. No successful automatic assignment journey is claimed yet.

## November 15 onboarding execution update

[The action coverage ledger](UE_V2_BASE_ACTION_COVERAGE.json) is the current action-level follow-up. Its unfilled fields remain unverified; the 17 accepted staging criteria do not fill them implicitly.

A fresh real organization administrator created a controlled invitation on accepted application `241006d3`. The recipient confirmed inbox receipt, acceptance to the dashboard, and creation/reopening of a test case. Independent read-only database queries confirmed the accepted invitation, verified active identity, exactly one active membership in the intended organization with role `member`, and an active session. [Redacted proof](evidence/ue-v2-onboarding-20261115/controlled-invitation-first-use-241006d3.json) separates those observations from user-attested casework. The account and test case are retained; no business data was deleted.

A later [read-only case and audit verification](evidence/ue-v2-onboarding-20261115/controlled-first-case-readback-241006d3.json) independently confirmed the saved case and its `case.intake_submitted` creation audit on the same accepted source. Reopening remains user-confirmed. The controlled account and case are retained as live staging data.

This closes the absence of positive invitation receipt/first-use evidence. It does **not** complete the repaired-source staging qualification: the invitation delivery-status UI, direct-admin entry, secure reissue/revocation, duplicate-request handling, required acceptance audit, MFA continuation and persistent setup repairs still need exact-source CI/admission and deployed positive/negative proof. New code/local tests are not described as deployed functionality.

Source review confirmed that the persistent setup API and console already existed. The former admin wizard used browser-only completion and advertised unavailable capabilities. The repair connects base admin setup to the persistent workflow and verifies invitation creation/acceptance against invitation records rather than inferring it from directory rows. The working repair also uses the same live business-session administrator predicate as profile management, and adds French base setup/support text, localized links and phone wrapping. Exact-source browser/staging proof remains required.

Automatic workload/expertise matching is explicitly required by the founder for the base release. The working candidate now connects actual claim and formal-grievance assignment controls to canonical grants, records administrator-configured expertise/capacity and ranks actual open workload. Local SQL tests cover saved outcomes, refusal and audit rollback; three native PostgreSQL tests cover last-slot contention, concurrent balancing and the shared manual-assignment capacity lock. Application source `78301eec` and its staging binding passed CI and were admitted through [PR #1247](https://github.com/anungis437/nzila-os/pull/1247) and [PR #1248](https://github.com/anungis437/nzila-os/pull/1248); deployed action qualification remains unfinished. The legacy direct-write engine is still unused. The follow-up document screen now exposes explicit transcript reading, draft saving, human review and separate evidence publication. Its five local gates and focused regressions passed ([local validation](evidence/ue-v2-document-review-20261116/local-validation.json)); actual machine extraction, review/publication, access boundaries and English/French/mobile behavior remain unqualified on staging. Correspondence, sealed-pack user export, connected supervision/closure, leadership content and the remaining operational matrices need the action-specific qualification in the ledger. Manual assignment, selected document access, or navigation is not substituted for those proofs.

## Working and verified in the accepted staging scope

The seven provisioned personas, scoped case/intake filing and assignment, member-directory access, representative case authority, document bytes/scanning/revocation, staff deadline creation/rescheduling/completion/cancellation, in-app conversation/reply persistence, formal-grievance reminder worker scenarios, English/French browser presentation, audit chains/current-case evidence seals, selected original data retention and bounded recovery all have final-source receipts. Manual intake deadlines are implemented; the older registry wording saying they cannot be completed predates the new case-deadline service.

The local-check repair and its exact command outcomes are recorded in [the evidence](evidence/ue-v2-execution-20261113/security-boundary/local-check-repair-7753084d.json). It changes the development environment, not the product feature set.

## Missing functionality within the deadline area

| Item | What exists | What remains absent |
| --- | --- | --- |
| Automatic legal filing-date calculation | Staff enter an explicit due date in the organization time zone. | The accepted case workflow does not calculate a legal deadline from a filing/incident date, jurisdiction, agreement rule or holiday calendar. |
| Intake-case reminder emails | Staff can create, reschedule, complete and cancel intake deadlines; members have authorized read-only access. | The scheduler currently runs only for `grievance_deadlines`; intake `claim_deadlines` return `remindersAvailable:false`. |

These limits were disclosed by the staging contract. They were not implemented by the local-check repair. Formal-grievance reminders are a separate implemented and tested path.

## Verification and operational work still unfinished

| Item | Existing evidence | Missing evidence or implementation |
| --- | --- | --- |
| New-member onboarding | Fresh accepted-source invitation receipt/dashboard/first case are user-confirmed; canonical identity/membership/session have independent readback. | Accepted-source case metadata and its creation audit now have independent readback; the account/case are retained. Repaired-source positive/negative qualification remains unfinished; see the action ledger. |
| Email receipt | Controlled invitation inbox receipt is user-confirmed. Worker scenarios separately prove provider acceptance, retry and continuity. | Formal deadline-recipient inbox receipt and terminal event correlation remain unqualified. |
| Physical mobile/browser targets | Real browser journeys and visual review at 390 px and 1440 px in English/French passed. | Physical-device and additional browser-engine certification is not in the accepted evidence. |
| Authenticated casework performance | The unchanged canonical public profile passed at p95 354.1058007 ms against 500 ms. | Latency/load qualification for the authenticated casework APIs is not established by that public profile. |
| Full-traffic failover | Restored-copy/native qualification and zero-traffic fault/recovered revision checks passed; the serving revision stayed at 100%. | A full-traffic failover exercise was not performed. |
| Continuous backup/audit status | One-time restore, migration retention, native audit-chain and evidence-seal verification passed. | The pilot operational-health backup-freshness and daily audit-seal probes still return unknown; continuous dashboard measurement is not implemented there. |
| Formal programme reconciliation | The scoped base contract has 17 required passes. | The global SaaS readiness ledger and 777-defect formal closure process remain held; scoped staging acceptance did not close them. No second independent founder/reviewer is required for this engineering work. |

## Other unavailable surfaces adjacent to the base areas

These are not silently counted as delivered by the staging acceptance:

- A direct Add Member form is unavailable. The implemented joining path is invitation-based; positive first use now has the bounded proof above, with the remaining adversarial/staging work recorded separately.
- The separate member case-timeline page is unavailable and unlinked; this is distinct from the tested case-detail workflow.
- Document approval workflows and template authoring are unavailable; document storage/access/evidence are the verified scope.
- SMS sending, campaign sending/scheduling and notification digest/quiet-hour controls are unavailable; persisted in-app conversations/replies are the verified messaging scope.

This list records implementation boundaries without adding those extensions to the release scope automatically. The capability registry contains older descriptions of the deadline paths and still needs reconciliation against the new service and final runtime evidence; it is not reliable to count every NOT_IMPLEMENTED row as a missing base workflow.

Finance/dues persistence and Financial Officer 2.1 remain excluded. This work changes no finance features and authorizes no production deployment. The serving application and its exact deployment provenance remain unchanged by the local dependency repair.

## Reproducing the repaired local checks

Run `pnpm install --frozen-lockfile` in this checkout. A dependency directory borrowed from a different checkout does not establish its workspace links.

The vault fixture uses isolated Python, so verify the selected interpreter with:

```sh
python3 -I -c 'from cryptography import x509'
```

A package installed only with `pip --user` is invisible in this mode. On this host, the same versions already present in the user site were installed into the selected development interpreter:

```sh
python3 -I -m pip install --no-user --only-binary=:all: cryptography==48.0.0 cffi==2.0.0 pycparser==3.0
```

The deployment backend lock was left unchanged; it targets CPython 3.11 on Linux x86_64 and explicitly is not portable to this macOS host. Lint warnings and existing test skips remain recorded. The four commands completed successfully with their existing definitions and limits.

## Sources checked

- [Case deadline service](../../../apps/union-eyes/lib/cases/case-deadlines.ts), including the formal-only scheduler and `remindersAvailable` decision; [deadline controls](../../../apps/union-eyes/components/claims/case-deadlines.tsx).
- [Invitation creation](../../../apps/union-eyes/app/api/auth/invite/create/route.ts), [acceptance](../../../apps/union-eyes/app/api/auth/invite/accept/route.ts) and [invitation service](../../../packages/platform-auth/src/invites/service.ts).
- [Seven-persona receipt](evidence/ue-v2-execution-20261113/security-boundary/actual-seven-personas-and-restoration-241006d3.json), [six base journeys](evidence/ue-v2-execution-20261113/security-boundary/actual-base-six-reconciled-241006d3.json) and [worker proof with reserved-recipient boundary](evidence/ue-v2-execution-20261113/security-boundary/actual-worker-six-and-retirement-241006d3.json).
- [Actual browser visual review](evidence/ue-v2-execution-20261113/security-boundary/actual-bilingual-mobile-core-visual-review-241006d3.json) and [bounded recovery](evidence/ue-v2-execution-20261113/security-boundary/actual-recovery-241006d3.json).
- [Operational health probes](../../../apps/union-eyes/lib/pilot-admin-operational.ts), [capability registry](../../../apps/union-eyes/lib/reality/capability-registry.ts), [global readiness ledger](../reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md) and [scoped acceptance contract](UE_STAGING_GO_CONTRACT.json).
