# UE Authority Source Closure and Integration Qualification

**Mission:** `UE-AUTHORITY-SOURCE-CLOSURE-1.1`
**Branch:** `agents/ue-authority-kernel`, from checkpoint `dcc2c40dc`. Code commits: `b6bb51acd`, `ad77c631f`. This document is the last commit.
**Staging / production:** NO-GO. **Persona convergence / six-branch merge:** not started.
**Earlier records:** `UE-AUTHORITY-KERNEL-PHASE-1-EVIDENCE.md`, `UE-AUTHORITY-KERNEL-PHASE-1-EXIT-EVIDENCE.md`. Counsel boundary: `UE-WORKAID-COUNSEL-BOUNDARY-CONTRACT.md`.

## 1. Determination

**Phase 1 remains FAIL.** This pass closed what could be closed from inside the repository and converted several vague blockers into exact, owned, evidenced ones. It did not make staging or production readiness claims, and it did not invent sources.

| Gate | Disposition | Why |
|---|---|---|
| Authority engine and storage | Locally qualified, PG15 and PG16 | unchanged; re-run on fresh databases |
| Identity source | **Open — architecture resolved, deployment unproven** | §3. The supported resolver exists and now drives the kernel; the binding table is absent from the lineage the approved bootstrap produces |
| Case sources | **Open** | assignment, reassignment, expiry, recusal, tenant denial proven; unit, territory and respondents still have no source |
| Finance sources | **Open (fail-closed)** | no governed approval workflow is deployed anywhere; §5 |
| Classification | Implemented, **policy unapproved** | §6 |
| WorkAid boundary | **Specified; verifier not built** | union side enforced and tested |
| Institutional / staging / credentials | **Open (external)** | §9 |

## 2. Branch and commit inventory

| Branch | Head | State |
|---|---|---|
| `agents/ue-authority-kernel` | this document's commit (code `ad77c631f`) | clean |
| `agents/ue-remove-clerk` | `f825b61fd` | untouched |
| `agents/frozen-governance-officer-21-architecture` | `4d86c3758` | untouched |
| member / representative / senior / executive / financial / WorkAid | `a8cb15f91` / `a0e7753fd` / `94126e853` / `638817da2` / `7ba993a31` / `541effda5` | untouched (WorkAid candidate read through `git show` only) |

Nothing pushed, merged or deployed. Disposable Docker databases were removed.

## 3. Identity-source closure (A)

### 3.1 Where each fact actually lives

| Fact | Authoritative location | Who may read it |
|---|---|---|
| Provider subject → principal | `public.platform_identity_bindings` **in the application database**, declared in `packages/db/src/schema/platform-authorization.ts`; migration `packages/db/drizzle/0041_platform_authorization_authority.sql` (**unapplied to every durable environment**, per `docs/architecture/NZILA_APPLICATION_AUTHORIZATION_MODEL.md`); present as `PLATFORM_IDENTITY_CURRENT` in the Union Eyes v2 plan | `nzila_auth_provider_reader` only, through `user_management.auth_provider_binding()` executed by `nzila_auth_provider`. No business role holds any privilege |
| Principal | `user_management.users.user_id` (varchar) | auth contexts; the business runtime sees only its own row |
| Membership and role | `user_management.organization_users` — a **compatibility projection**; the canonical successor is `platform_organization_memberships` (needs the shared `orgs` table) | reader-owned definer predicates that require a live session in the organization |
| Session | `user_management.user_sessions` (raw bearer hashed inside the database) | the same predicates |

The production-intended resolver is **not** this kernel. It is `resolveExternalAuthIdentity` and `withAuthenticatedOrgBinding`/`withBearerOrgBinding` in `packages/platform-auth`, mirrored by `backend/auth_core/canonical_context.py` (provider phase, identity phase, explicit organization, live session, then `app.current_user_id`, `app.current_org_id`, `app.current_session_token`). Entra groups are signals only; no binding is created at sign-in or by email.

### 3.2 What changed

- **Removed** the kernel's own direct reads of `platform_identity_bindings` (`resolveInternalPrincipal`), `resolveAuthorityPrincipal` and `listActiveOrganizations`. They read a table no role may read in the intended design, and the last two enumerated memberships outside the supported organization selection. Their earlier "finding" that the table was missing was a symptom of this.
- **Added** `platform-identity.ts`: `runBoundAuthorityTransaction` (actor, tenant and session taken **only** from a verified binding, with the session token carried into the transaction), `resolveProviderPrincipal` (re-validates the resolver's answer: echoed identity, active state, verification, principal id), and `membershipSourceViaDefiner` plus `compileAuthorityMembershipReaderSql()` — a reader-owned definer function that adds **no table privilege** and answers only when the caller's live session authorises the organization.
- **No second binding table was created.**

### 3.3 Proof (real v2 auth bootstrap, disposable PG15 and PG16, 9/9 each)

`authority-kernel-identity-path.native.test.ts` uses the real compiled auth fixture and bootstrap, the real `resolveExternalAuthIdentity`, `createSession` and `withBearerOrgBinding`. It proves: no business role has any privilege on the binding table; provider claims resolve to the right principal; unbound, foreign-tenant, suspended-principal, revoked and disabled bindings all stop resolution; claims → principal → membership → live session → decision → RLS context as the runtime role; a decision for anyone but the bound actor is refused; the president (executive capacity) has no case access without a relationship; a binding is per organization (multi-organization membership needs a separate session, and the other organization's members are invisible); expired, deactivated, wrong-token and membership-removed contexts see nothing; the definer is executable only by the runtime role and owned by the reader. Run with `UE_AUTHORITY_IDENTITY_NATIVE=1` (needs Docker).

### 3.4 Remaining identity blockers

1. **The approved legacy bootstrap does not produce the binding table, the `nzila_auth_*` roles or the definer predicates**; those exist only in the v2 bootstrap, which the docs state is prospective and not wired to existing commands. Production-intended identity therefore cannot run on the currently approved path. Owner: platform/identity. Missing proof: governed adoption of migration `0041` (or the v2 bootstrap) and of `compileAuthorityMembershipReaderSql()` into `packages/db`'s auth-storage-authority, with their catalog verifier updated for the extra function.
2. The kernel's own 14 relations are not in the v2 source plan; qualifying them under v2 is separate work. Owner: kernel + platform.
3. Entra token signature verification and the real Entra claims are gateway concerns and were not exercised.

The legacy-lineage `membershipSourceVia(union_eyes_system)` remains only for that lineage and is documented as such.

## 4. Case and representation sources (B)

| Fact | Source | Status |
|---|---|---|
| Case, creator, classification | `public.grievances` (`created_by`, `has_legal_implications`, `is_confidential`) | Sourced |
| Explicit collaborators | `grievance_case_access_assignments` | Sourced |
| Representative assigned (primary LRO) | `grievances.union_rep_id` (uuid, **no foreign key**) | **Evidence it is read as a principal id** by `services/case-access-service.ts` and `lib/deadline-engine/recipient-resolver.ts`; deliberately **not authority**: any route that can UPDATE a grievance can rewrite it, so deriving ownership from it would make the kernel as weak as the weakest legacy route. Authority comes only from governed `assignCase`; `reconcileCaseOwnership` reports drift (read-only) for a governed backfill |
| Grievant / represented member | `grievances.grievant_id` (uuid, no verified mapping) | Blocked — only the creator relationship exists |
| Unit / territory | none on `grievances` (`employer_id`, `workplace_id`, `cba_id` are not verified units); `grievance_assignments` is keyed to the legacy `claims` model | **Blocked** — unit/territory-scoped mandates reach no case; resource-id scoped mandates work |
| Respondents | none (`employer_rep_id` is the employer side) | **Blocked** — nobody is excluded as respondent by the loader |
| Supervisor mandate | kernel `ue_authority_mandates`, issued only through a rule-governed, approved, accepted ceremony | Kernel-owned, proven |

**Fixed:** revoking a case assignment skipped the `case:assign` requirement (non-conferring operations returned before domain protections); a steward with no authority could end an assignment. It now needs the same authority and an active `case_assignment`/`revoke` rule (new default template).

**Proven (PGlite, `authority-kernel-case-sources.pglite.test.ts`, 13 tests):** explicit assignment; rank, role title and the legacy column grant nothing; unauthorised issuer, ineligible and self assignment refused; reassignment atomic with rollback when the incoming assignee is refused; revocation needs authority; time-boxed assignment expires; recusal removes access until an authorised other lifts it and the recused cannot lift it; another organization's case cannot be assigned or read; unit/territory scope stays fail-closed.

## 5. Financial source reconciliation (C)

| Entity | Where | Governed approval workflow? |
|---|---|---|
| `payments` (Drizzle: amount, currency, member, type, status, created_by) | `db/schema/domains/finance/payments.ts`, `db/migrations/0008` | A payment-processing record; **no approver/executor actors** |
| `payments` (deployed Django-first lineage) | `backend/billing/models.py` | **Four-column stub** (id, timestamps, organization) |
| `dues_transactions`, `member_dues_ledger`, `member_arrears`, `employer_remittances`, `per_capita_remittances` | Drizzle and Django | Ledger/remittance records; Django versions are partial stubs |
| `remittance_approvals` | Django stub (`remittance_id`, `approver_user_id`) | Only a stub; no Drizzle declaration |
| `strike_fund_disbursements` | `db/schema/domains/finance/taxes.ts` | Tax record (amount, payee, week totals); **no approval actors** |
| `expense_requests`, `expense_approvals`, `vendors`, `vendor_invoices`, `accounts_payable`, `budgets` | `services/financial-service` (95 tables) | **The only real approval workflow, with no deployment path**; classified LATENT_UNREACHABLE with zero privileges (`db/rls-storage-authority/financial-service-latent.ts`); 11 of the tables were never migrated |

**Disposition.** There is no deployed, governed financial workflow to authorize against. Added `financeSourceReadiness` (names the exact missing columns) and a registration guard (`FINANCE_SOURCE_UNAVAILABLE`). Finance actions stay unavailable on the stub, and are proven to deny for every principal; where a payments source with amount, currency and payer exists the kernel-owned step ledger enforces separation of duties. Owner: finance domain. Missing proof: a decision on which entity is the disbursement/approval record, then its deployment and RLS.

## 6. Information classification (D)

Provisional, **unapproved** default (`lib/authority/document-class.ts`, `approvedBy: null`):

| Class | Action | Reader | Notes |
|---|---|---|---|
| `member_submission` | `case:read_own_submission` | creator / represented member, for their own non-privileged upload | survives a privileged case; authorship verified by the loader |
| `member_disclosable` | `case:read` | member | **empty by default**; exists only under an institution-approved policy naming labels |
| `union_working` | `case:read_internal` | handlers with an explicit scope | includes `public_internal`, unknown and missing labels |
| `union_restricted` | `case:read_internal` | same | `lro_confidential` |
| `third_party_restricted` | `case:read_third_party_restricted` | primary owner/assignee, an explicit named collaborator grant, or a mandate naming the power | `case_restricted` label and medical/disciplinary/member-PII flags, for anyone but the uploader |
| `privileged` | `case:read_privileged` | explicit privileged-access relationship | legal-privilege flag or `privileged`/`highly_sensitive` |
| `counsel_controlled` | none | nobody | accepted WorkAid referral |

**Revised against the review:** (1) `secondary_lro` and `reviewer` now need an **active, case-specific assignment and the explicit internal-file scope** (the assignment's `can_edit_case_notes`); the role label alone gives nothing, a read-only collaborator never reads the internal file, and privileged access is not an internal scope. (2) `public_internal` is **not** member-disclosable by label. (3) Third-party restricted records have their own narrower action. (4) Revoking someone's authority to work a case does not give them access by authorship; a contributor's own record is released only through an institutional review, which is **not implemented** and is a policy decision below.

Proof: 14 classified-document PGlite cases, 9 pure-kernel tests (5 third-party access, 4 classification policy), and a case on the real deployed `documents` table on PG15/16.

**Stakeholder decisions required (nothing here is active as institutional policy):** which labels, if any, are member-disclosable; whether `case_restricted` plus the sensitivity flags is the right third-party definition and who may read them; whether the internal-file scope should be a distinct flag rather than `can_edit_case_notes`; the review mechanism for a revoked contributor's own records.

## 7. WorkAid boundary (E)

Specified in `UE-WORKAID-COUNSEL-BOUNDARY-CONTRACT.md`. Implemented and tested this pass: union members can never act as counsel even if a verifier vouches for them (`COUNSEL_IS_UNION_MEMBER`); missing verifier or memberships source refuses; the counsel assertion envelope (issuer allow-list, audience, organization and matter binding, 5-minute lifetime, no future issue, single-use nonce). **Not built:** the counsel-side authenticator and signature verification. Privileged actions stay blocked.

## 8. Persona-to-authority action matrix

| Persona | Actions | Source of authority | State |
|---|---|---|---|
| Member | read own case; comment; read own submissions; open a review; give or revoke WorkAid referral consent | creator relationship; member-issued consent | Works. Represented-member (grievant) mapping blocked |
| Representative | work an assigned case; read internal file; write; transition; refer to WorkAid | explicit assignment + capacity + explicit internal scope; `workaid:refer` needs relationship **and** consent | Works via governed assignment; legacy owner backfill pending |
| Senior Representative | assign, reassign and revoke assignments; supervise named cases | supervisory mandate with `assign` (issued by an officer/executive, independently approved, accepted); resource-id scope | Works; unit/territory scope blocked |
| Officer / Executive | adopt issuance rules; issue, suspend and revoke mandates; delegate; succeed offices; approve | office mandate; two-approver adoption ceremony; rule-governed issuance | Works; no institution has adopted rules |
| Financial Officer | prepare, approve, execute, reconcile, audit | financial mandate + step ledger | **Unavailable** (no source) |
| Governance Officer | monitor, access evidence, issue findings, request corrective action, enforce, verify remediation; recusal | review-bound mandates; five independent powers; no privileged reach | Works on the kernel-owned review register; no common review subject |
| WorkAid / counsel | accept referral; issue disclosure; receive disclosure | counsel-side verified identity | **Blocked** by design until the verifier exists |

## 9. Defect-closure table

| Review item | Disposition |
|---|---|
| Runtime access to identity tables unproven | **Closed locally** on the real v2 bootstrap (definer path, PG15/16). Deployment wiring open (§3.4) |
| Counsel acceptance caller-supplied actor | **Closed** (earlier) and extended: union members excluded; assertion envelope |
| Case resource facts incomplete | **Partially closed**: assignment lifecycle proven; unit/territory/respondents remain blocked and fail-closed |
| Finance resource facts incomplete | **Closed as fail-closed**; no governed source exists (§5) |
| Governance resource facts incomplete | Kernel-owned review register (no common subject exists); unchanged |
| Full Django + authority replay | **Closed locally** (PG15/16, re-run after this pass's changes). No migration byte changes this pass; registered hashes verified |
| Privileged-case creator/member policy | **Revised** into classes (§6); institutional approval open |
| Grant activation on Windows | **Closed** (earlier) |
| Migration additions not staging-qualified | **Open** — needs a staging clone. Owner: release engineering |
| Test credentials possibly active | **Open (external)** — no evidence of rotation or disablement exists in the repository. Owner: identity operations. Exact missing proof: dated evidence that the ~45 staging Entra accounts' old password is rejected, or that the accounts are disabled |
| Interim policy 1: `secondary_lro`/`reviewer` read internal file | **Revised** to explicit scope |
| Interim policy 2: `public_internal` member-visible | **Reversed** |
| Interim policy 3: third-party restricted = internal | **Reversed**; own class and action |
| Webhook consumer unverified | **Open (external).** Discovery: no in-repo caller; `.github/workflows/deploy-union-eyes.yml` provisions `AUTH_WEBHOOK_SECRET` from secret `auth-webhook-secret`, so a sender is expected. Owner: integration. Missing proof: the sender's identity from the IdP/automation configuration and a delivery log |
| Whop compatibility | **Open (external).** Only `app/api/whop/create-checkout` sends the legacy `clerkUserId` alongside `userId`; no consumer exists in the repository. Owner: billing integration. Missing proof: confirmation the Whop-side consumer reads `userId` |
| Other Clerk residue found | `packages/db/src/schema/partners.ts` declares `clerk_user_id` (partner training table) and `packages/os-core/src/evidence/redaction.ts` strips it. Outside the Union Eyes cleanup; owner: partners/platform |

## 10. Adversarial and qualification evidence (local)

| Suite | Result |
|---|---|
| `lib/authority` + all `db` default run | 1771 passed, 91 skipped (need Docker or a database), 0 failed |
| Native v2 identity path | 9/9 on PG16 and PG15 |
| Combined Django + approved bootstrap, as the runtime role | 10/10 on PG16 and PG15 |
| Storage + Django audit-chain suites | 15/15 on PG16 and PG15 |
| `tsc --noEmit`, eslint on the authority code | clean |
| Registered migration hashes | `0013` `f853a13f…` and `0020` `45873e54…` unchanged this pass; no lineage violations |

Mutation testing was **not** re-run this pass; the new behaviours are covered by the negative cases listed above (revoke without `case:assign`, internal read by role label, third-party read by internal scope, a union member vouched as counsel, the creator reading union-internal records).

## 11. External blockers with owners

| # | Blocker | Owner | Exact missing proof |
|---|---|---|---|
| 1 | Adopt the v2 identity stack and the membership reader into the deployment path | Platform / identity | Governed migration `0041` (or v2) applied to a non-production clone with the catalog verifier green including the added function |
| 2 | Qualify the kernel's 14 relations under v2 | Kernel + platform | They appear in the v2 plan and pass its native matrix |
| 3 | Unit/territory, respondents, grievant mapping | Grievance domain | Authoritative columns or relations, with ownership and a backfill plan |
| 4 | Finance approval record | Finance domain | Decision on the authoritative disbursement/approval entity and its deployment |
| 5 | Counsel-side verifier | WorkAid / counsel interface | The four acceptance tests in the counsel contract |
| 6 | Institutional policy: classification, internal scope, contributor review | Each institution's governance body | Approved instruments naming labels and scopes |
| 7 | Issuance rule adoption | Each institution | Two-approver adoption with real source instruments |
| 8 | Staging clone qualification of `0013`/`0020` | Release engineering | Clone run through the existing gate |
| 9 | Credential rotation evidence | Identity operations | Dated rejection or disablement evidence |
| 10 | Webhook and Whop consumers | Integration / billing | Sender identity and delivery logs |

## 12. Recommendation

Do not begin persona convergence. The enforcement machinery is sound and now takes identity from the supported platform path. What is missing is deployment of that path, authoritative case-jurisdiction and finance sources, the counsel verifier, and institutional approvals. When blocker 1 is closed on a clone, case and document routes, mandate issuance, delegation, recusal and assignment can be migrated first, behind the provisional conservative classification. Staging and production remain NO-GO.
