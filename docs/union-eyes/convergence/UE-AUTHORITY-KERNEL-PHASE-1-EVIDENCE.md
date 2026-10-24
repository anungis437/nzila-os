# UE Authority Kernel — Phase 1 Evidence, Compatibility Contract and Open Decisions

Branch: `agents/ue-authority-kernel` (base `0c994b968`). Not pushed. Not merged. No persona route has been changed.
Staging and production: **NO-GO**. Phase 2 route integration: **blocked pending review of this record**.

Proof class: **SOURCE_INSPECTED + LOCAL_TEST**. Database proofs ran on a disposable PGlite instance and a disposable PostgreSQL 16 container. No Azure, staging or production database was touched.

## 1. Commits

| SHA | Content |
|---|---|
| `0c9532269` | Pure kernel: ontology, capacity, common assessment, policies (case, finance, governance, WorkAid), 183 adversarial tests |
| `3a999601b` | Governed storage, in-transaction recording, store layer, PGlite and real-PostgreSQL tests |

## 2. What exists

### Pure decision kernel (`apps/union-eyes/lib/authority/`)
`decide(request, facts, resourceFacts, now) → Decision` (allow/deny, scope, sources of authority, reasons, obligations, authority line, policy version). Pure, deterministic, never throws; any failure is a deny.

Doctrine encoded: a role is **eligibility only** (`capacity.ts` explicit table, no numeric hierarchy); platform, federation and national roles map to no customer capacity; every mandate has an expiry, a source instrument and a grantor other than the holder; recusal and adverse-party status are absolute; supervisory and delegated authority never reach privileged or counsel-controlled matters; financial duties are not delegable and are segregated against the transaction's actual participants; governance approval is one person one vote by authority line, and high-risk approvals need two or more and cannot be delegated; WorkAid counsel material is never readable by the union.

### Governed storage
| Artifact | Purpose |
|---|---|
| `db/migrations-platform/0013_authority_kernel_storage.sql` | Eight `ue_authority_*` relations, constraints and triggers |
| `db/migrations-cache/0020_authority_kernel_rls_closure.sql` | FORCE RLS through `ue_create_direct_org_rls_policy` (fail-closed preflight) |
| `db/rls-storage-authority/authority-kernel.ts` | Registry entries (8); runtime DML never includes DELETE |
| `db/schema/domains/ml/authority-kernel.ts` | Drizzle declaration (canonical scope for the registry census) |
| journals, `union-eyes-bootstrap-stages.mjs`, `union-eyes-catalog-authority.mjs`, platform README | Lineage wiring |

Relations: `ue_authority_mandates`, `_resource_relationships`, `_delegations`, `_recusals`, `_disclosure_consents`, `_approval_requests`, `_approval_decisions`, `_events`.

Integrity enforced by the database, independent of any caller:

| Rule | Mechanism |
|---|---|
| Every mandate, delegation and consent expires | `expires_at NOT NULL`, `expires_at > effective_at` |
| Grantor differs from holder; recused person cannot lift own recusal | CHECK |
| Emergency access: read-only, at most 24 h, justified (>= 20 chars), independently approved | CHECK |
| Financial, oversight, privileged-case and counsel powers are not delegable | CHECK on delegation actions |
| Collaborator or privileged relationship must be explicit, named, granted by someone else | CHECK |
| Union referral consent is the member's own act; counsel disclosure is counsel-issued and names a recipient | CHECK |
| Authority rows are append-only; revocation or lifting is the only update and is terminal | `ue_authority_guard_update` (jsonb diff against an allow-list), DELETE/TRUNCATE blocked |
| One person, one vote per request | `UNIQUE (org, request, authority_line)` and `UNIQUE (org, request, approver)` |
| Self-approval, adverse party, recusal, non-named approver, invalid or high-risk delegation refused | `ue_authority_guard_decision` |
| Concurrent decisions serialise | `SELECT ... FOR UPDATE` on the request inside the decision trigger |
| Request status resolves only as a consequence of a decision | request guard trigger (`pg_trigger_depth`) |
| High-risk requests require two or more approvals | CHECK |
| A mutation cannot commit without its durable record | `AFTER INSERT OR UPDATE` trigger writes `ue_authority_events` in the same transaction |
| Events cannot be forged, altered or removed | insert guard (trigger depth), update/delete/truncate blocked |

### Store layer (`lib/authority/store/`)
`runAuthorityTransaction` (single dedicated connection, `BEGIN`, tenant and actor GUCs, `COMMIT`/`ROLLBACK`), `loadAuthorityFacts` (also loads delegators' facts), `loadApprovalRequestFacts`, `enforceAuthority` (fail-closed), and mutations. `recordApprovalDecision` gates on the kernel first, stores the kernel's authority line (not the caller's claim), then relies on the database trigger for integrity.

## 3. Answer to the audit-atomicity finding

Phase 0 said failing on an audit-write failure is not the same as atomically preventing the mutation. For **authority-kernel mutations** this is now addressed structurally:

- the mutation and its `ue_authority_events` record are one transaction by construction (trigger), proven by test: a rolled-back mutation leaves neither row nor event, and a failing event write rolls the business row back;
- the actor and tenant are pinned per transaction;
- on real PostgreSQL, concurrent decisions produce exactly the recorded outcome (section 4).

**Not yet true, and not claimed:** the canonical tamper-evident chain (`audit_logs`, `appendCanonicalAuditLog`) is not yet appended by the store. It can be, inside the same `runAuthorityTransaction`, because `appendCanonicalAuditLog(tx, ...)` already takes a transaction and an advisory lock. Wiring it, and a reconciliation check that every `ue_authority_events` row has a chain row, is Phase 2 work. The existing persona routes that audit on a separate connection remain unqualified until migrated.

## 4. Test evidence

| Suite | Result |
|---|---|
| `lib/authority/__tests__` (kernel) | 183 passed; 10 of 10 policy mutants killed (earlier checkpoint) |
| `db/__tests__/authority-kernel-storage.pglite.test.ts` | 41 passed |
| `db/__tests__/authority-kernel-storage.postgres.test.ts` on PostgreSQL 16 (`UE_AUTHORITY_PG_URL`, skipped otherwise) | 6 passed |
| `db` directory | 1420 passed, 63 skipped, 0 failed |
| `tsc --noEmit` (union-eyes) | clean |

Database mutants killed: self-approval check disabled; UPDATE events not recorded; terminal revocation disabled; RLS missing on one table (4 tests); **removing the row lock** (2 real-PostgreSQL race tests fail with a request stuck `open` holding two approvals, the lost-update defect).

Real-PostgreSQL race tests (15 iterations each): two approvers on a 2-approval request both land and resolve to satisfied exactly once; two approvers on a 1-approval request record exactly one decision; a delegate and their delegator cannot cast two votes for one authority line; one person racing themselves records one vote; a failed transaction leaves nothing; events cannot be forged or removed as the runtime role.

Required adversarial properties from the brief:

| Property | Proven by |
|---|---|
| Expiry | NOT NULL + term CHECK; kernel liveness tests |
| Revocation | terminal-update test; loader excludes revoked rows |
| Foreign-tenant denial | FORCE RLS tests; cross-org revoke and decide refused |
| Self-approval denial | kernel tests and database trigger (kernel bypassed) |
| Recusal | kernel tests and database trigger (kernel bypassed) |
| Concurrent decisions | real PostgreSQL race tests |

## 5. Known red test outside this change's control

`tooling/scripts/lib/ue-staging-clone-qualification.test.mjs`: 2 of 37 tests fail (`complete synthetic semantic vector...`, `a self-consistent isolation proof for another baseline still fails`) with `Exact 20 scoped/16 platform hashes required`. The gate, bound to `CHG-2026-0112` / `UE-STAGING-RECOVERY-TO-GO`, pins the exact migration lineage. **Any new scoped or platform migration invalidates that qualification.** It passes on the baseline worktree (37/37). I did not edit the gate, because its counts and hashes belong to a measured staging recovery and must be re-measured by its owner, not adjusted to make a test pass.

Consequence: these migrations cannot join the staging-recovery lineage without re-qualification. Sequencing is a maintainer decision (section 8).

## 6. Compatibility contract for the six personas and WorkAid

Phase 0 register IDs (S1–S7) are cited. "Kernel action" names are in `ontology.ts`. No persona code has been migrated.

| Persona / source | Current pattern (Phase 0 evidence) | Kernel replacement | Migration rule |
|---|---|---|---|
| **Member 2.1** (`a8cb15f91`) | Document helper with `isStewardPlus` steward-wide shortcuts (17 files); conflicts with Senior in 4 document and search routes (S2) | `case:read` through an explicit relationship (`represented_member`, `creator`, `owner`, `assignee`, `collaborator`). A member's own record: `subject`. | Keep member document improvements; replace every `isStewardPlus` branch with a relationship decision. Seniority never admits an unrelated case. |
| **Representative 2.2** (`a0e7753fd`) | `case_read_any` in 15 files (S1); transition-reason disclosure unconfirmed (S7) | `case:read` (member-visible scope), `case:read_internal`, `case:comment`, `case:write`, `case:transition` via relationship or a supervisory mandate with scope. Output `scope.visibility` and `redact_internal_notes` obligation. | Replace each `case_read_any` shortcut. It must not override recusal, privilege or confidentiality. S7 stays an investigation item until its source is established. |
| **Senior Representative 2.1** (`94126e853`) | Removes seniority access (`isStewardPlus` 15 to 7); strict case confidentiality | `case:read*`, `case:assign` through a `supervisory` mandate with unit or territory scope, classification ceiling, expiry. Privileged matters excluded. | Do not merge this branch first as the de facto model. Integrate its tests as acceptance cases against the kernel. |
| **Officer / Executive 2.1** (`638817da2`) | `withMinRole('secretary_treasurer')` on finance routes (13 files); hierarchy admits admin, president, vice-president, national officer (S3, S3a) | Governance: `governance:approve` (named approver or `executive_office` mandate with `approve` power; delegation allowed only below high risk). Case supervision as above. Finance gates removed in favour of the finance policy. | No hierarchy gate may remain on an approval or execution path. |
| **Financial Officer 2.1** (`7ba993a31`) | Finance gate left at `officer`; handler changed; 4th suppressed audit catch (S3, S6) | `finance:view`, `finance:prepare`, `finance:approve`, `finance:execute`, `finance:reconcile`, `finance:audit` with a `financial` mandate (limit in integer minor units, single currency), incompatible-duty segregation. Not delegable. Member financial records scoped by account. | The `exec` x `fin` textual-clean merge is unsafe; both gates are replaced by the same finance policy. Resolve the 4th audit catch during migration. |
| **Governance Officer 2.1** (`4d86c3758`) | Separate review engine; `GOVERNANCE_ROLES` includes `compliance_manager` and `security_manager` (S4); `GOVERNANCE_SYSTEM_ROLES` includes `clc_staff`, `clc_executive` (S5) | `review:monitor`, `review:access_evidence`, `review:issue_finding`, `review:request_corrective_action`, `review:enforce`, `review:verify_remediation` through a `governance_review` mandate. The five powers stay independent; none delegable; remediation owner cannot verify own work. | `compliance_manager`, `security_manager`, `clc_*` map to no customer capacity (`NON_CUSTOMER_AUTHORITY_ROLES`). Their continued presence in role mappings grants nothing at the kernel. S4 and S5 navigation and allow-list changes are separate decisions. |
| **WorkAid** (`541effda5`, 184 files, separate workstream) | Not assessed | `workaid:refer` (relationship and unexpired member-issued consent), `workaid:receive_disclosure` (counsel-issued record naming the recipient), `workaid:read_counsel_material` (always denied). | Boundary only. The kernel assumes no counsel-side authority. Assess the 184 files separately before designing the interface. |

Case-read replacement rule (single policy): `case:read` is allowed only from a live relationship, a live in-scope supervisory mandate, a validated delegation (counted under the delegator), or a time-boxed emergency grant. It is denied for recused, adverse, privileged and counsel-controlled matters regardless of source.

Financial replacement rule: viewing, preparing, approving, executing, reconciling and auditing are distinct actions with distinct mandates; approval never follows from a role title; the transaction's preparer, approvers, executor and reconciler cannot hold incompatible duties on the same transaction.

## 7. What is not built

| Item | Status |
|---|---|
| Membership source bound to the canonical organization-membership relation | Port only. Test double used. Needs a Phase 2 adapter and the identity mapping from Entra `tid:oid` to the internal user uuid |
| Resource-fact loaders for cases, finance transactions, reviews, WorkAid matters | Not built; they live in existing tables owned by persona routes |
| Canonical audit chain append in the same transaction, plus reconciliation | Not built (section 3) |
| Grants through the real activation pipeline | Test grants are derived from the registry; `activateCatalogPrivileges` was not run |
| Approval request `withdrawn` | The database permits the transition; who may withdraw is an application-layer rule not yet enforced |
| Real-Postgres coverage of RLS role switching with login roles | Tested with `SET ROLE` on a superuser connection, not with distinct login roles |
| Any run against Azure PostgreSQL, staging or production | None |

## 8. Unresolved institutional decisions

1. **Who may issue a mandate, delegation or recusal?** The frozen persona contracts do not say. The store records these acts but does not authorise them. A governed issuance workflow (including who may lift a recusal) is required before any route exposes them.
2. **Migration sequencing against the staging-recovery lineage** (section 5): ship these migrations after `CHG-2026-0112` closes, or have its owner re-measure.
3. **`GOVERNANCE_SYSTEM_ROLES` and the CLC roles** (S5): which customer-federation roles, if any, may act on Class-B reserved matters, and under what mandate.
4. **`compliance_manager` / `security_manager` in `GOVERNANCE_ROLES`** (S4): platform roles in the customer governance navigation.
5. **Emergency access**: confirm the 24 h ceiling and the independent approver class for each tenant.
6. **Expiry policy for relationships**: derived relationships may be open-ended; confirm whether explicit collaborators need a mandatory term.
7. **Identity of record** for `principal_user_id`: confirm the canonical internal user uuid and how federation and national staff, who hold no customer capacity, are represented when a customer grants them a scoped mandate.
8. **Preservation of the six unpushed candidate branches**: still local only.
9. **Tenant `admin`** maps to `member` capacity only, so an organization administrator gains no case, money or governance authority from the title. Confirm this is intended; any such access must arrive through a mandate or relationship, which may remove access some existing admin workflows currently assume.

## 9. Disposition

| Question | Answer |
|---|---|
| Is a standalone, tested, source-backed kernel with governed persistence present? | Yes, locally, as above |
| Is the complete persona-action mapping present? | Yes, at the contract level; no route migrated |
| Phase 1 exit | Pending review. Not self-certified |
| Phase 2 route integration | Blocked pending review |
| Six-persona merge | Not started |
| Local operational readiness, staging, production | **NO-GO** |
