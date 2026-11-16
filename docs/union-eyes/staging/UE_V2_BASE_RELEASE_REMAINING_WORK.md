# Union Eyes V2 base-release remaining work

The accepted staging record proves the named casework and access journeys on application `241006d302c14567e541d619675fbead3ec3f258`. It is not a statement that every capability in the application is implemented, or that production readiness has been signed off. This review uses repository snapshot `7753084d79c9db310bc483b87ade0de76415cd7e`, whose Union Eyes application tree is unchanged from that accepted source.

Some earlier defect remediation removed misleading controls or changed false success into an honest unavailable response. Those changes repaired the false behavior while leaving the capability unavailable. A source-remediation count is not a count of implemented features.

## November 15 onboarding execution update

[The action coverage ledger](UE_V2_BASE_ACTION_COVERAGE.json) is the current action-level follow-up. Its unfilled fields remain unverified; the 17 accepted staging criteria do not fill them implicitly.

A fresh real organization administrator created a controlled invitation on accepted application `241006d3`. The recipient confirmed inbox receipt, acceptance to the dashboard, and creation/reopening of a test case. Independent read-only database queries confirmed the accepted invitation, verified active identity, exactly one active membership in the intended organization with role `member`, and an active session. [Redacted proof](evidence/ue-v2-onboarding-20261115/controlled-invitation-first-use-241006d3.json) separates those observations from user-attested casework. The account and test case are retained; no business data was deleted.

This closes the absence of positive invitation receipt/first-use evidence. It does **not** complete the repaired-source staging qualification: the invitation delivery-status UI, direct-admin entry, secure reissue/revocation, duplicate-request handling, required acceptance audit, MFA continuation and persistent setup repairs still need exact-source CI/admission and deployed positive/negative proof. New code/local tests are not described as deployed functionality.

Source review confirmed that the persistent setup API and console already existed. The former admin wizard used browser-only completion and advertised unavailable capabilities. The repair connects base admin setup to the persistent workflow and verifies invitation creation/acceptance against invitation records rather than inferring it from directory rows.

Automatic workload/expertise matching is explicitly required by the founder for the base release. The working candidate now connects actual claim and formal-grievance assignment controls to canonical grants, records administrator-configured expertise/capacity and ranks actual open workload. Local SQL tests cover saved outcomes, refusal and audit rollback; three native PostgreSQL tests cover last-slot contention, concurrent balancing and the shared manual-assignment capacity lock. Exact-source CI, admission/deployment and real staging action qualification remain unfinished. The legacy direct-write engine is still unused. OCR, correspondence, sealed-pack user export, connected supervision/closure, leadership content and the remaining operational matrices need the action-specific qualification in the ledger. Manual assignment, selected document access, or navigation is not substituted for those proofs.

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
| New-member onboarding | Fresh accepted-source invitation receipt/dashboard/first case are user-confirmed; canonical identity/membership/session have independent readback. | Repaired-source staged negatives, audit/case readback and retained-fixture disposition remain unfinished; see the action ledger. |
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
