# SAGE World-Class Implementation Blueprint

> **Internal implementation blueprint. Not public copy. Not a product availability claim. Not for external use unless separately reviewed and approved.**

## Template metadata

| Field | Value |
| --- | --- |
| Status | Internal implementation blueprint (final planning-only SAGE artifact) |
| Owner | Nzila Ventures |
| Last updated | 2026-07-12 |
| Related framework | CIVIC / CLEAR / SAGE |
| Public or internal | Internal only |
| Next step | Begin Phase 1 engineering (repo-native domain model) |

## 1. Purpose

This blueprint converts SAGE from a future/manual workspace pattern into an implementation program. It
defines what world-class implementation means, what must be built, what must not be claimed prematurely, and
what validation gates must pass before SAGE can be treated as implemented.

## 2. Implementation objective

SAGE must become a secure, reviewable, human-controlled workspace for organizing service assurance and
governance evidence across public-service continuity, implementation, accountability, and readiness
questions.

The objective is not to create an automated decision system. The objective is to create a disciplined
evidence workspace that helps authorized users organize institutional evidence, preserve provenance, track
open questions, and support accountable human review.

## 3. Implementation posture

SAGE is moving from manual/future pattern to active implementation track. Until implementation gates pass,
external language remains non-availability language, but internal work should now treat SAGE as an active
build target.

The restriction on public/product/procurement claims does not restrict internal implementation. Build
internally; restrict external claims until implementation is complete and separately approved.

This is the final planning-only SAGE PR. The next PR must begin engineering implementation.

> **Implementation status (Phase 1 started).** Phase 1 engineering has begun. Repo-native artifacts:
> `migrations/0032_sage_phase_1_access_domain_lock.sql` (SAGE enums + access/domain tables) and the
> `packages/sage-core` package (types, permission/audit constants, `deriveSageBoundaryProfile`,
> implementation-blocking invariants, access model, and negative-path tests). Boundaries remain unchanged;
> nothing here is launched, available, or procurement-ready.

> **Implementation status (Phase 2 started).** The `@nzila/sage-core` service layer is now executable:
> `service-context.ts`, `service-errors.ts`, `repository.ts` (port + in-memory impl), `audit-sink.ts`, and
> `services.ts` orchestrate workspace/membership/role/evidence/decision/export flows with permission checks,
> org-boundary enforcement, invariant enforcement, and SAGE audit emission (integrating with `@nzila/audit`).
> Covered by `services.test.ts`. Boundaries unchanged; still not launched, available, or procurement-ready.

> **Implementation status (Phase 3 started).** SQL-backed `SageRepository` added behind the existing
> service layer: `sql-client.ts` (framework-free `SageSqlClient`), `postgres-repository.ts`
> (`PostgresSageRepository`), and `postgres-mappers.ts` (snake_case ↔ TypeScript row mapping), with
> `postgres-repository.test.ts` covering parameterized SQL, org/workspace boundaries, membership-vs-role
> separation, revocation, export status, and mapping. Migration `0033_sage_phase_3_review_note.sql` adds the
> `sage_review_note` table. Boundaries unchanged; still not launched, available, or procurement-ready.

> **Implementation status (Phase 4 started).** Authenticated platform-admin workspace create/list/view
> vertical slice implemented using the SAGE service layer and SQL-backed repository. In `apps/platform-admin`:
> `lib/sage/` runtime composition (`runtime.ts`, `sql-adapter.ts`, `audit-adapter.ts`, `workspace-service.ts`,
> `schemas.ts`, `view.ts`), API routes under `app/api/sage/workspaces`, and pages under `app/sage`. orgId and
> actorId derive from the authenticated session (never the browser); cross-org access returns 404
> (non-disclosure); summaries are counts/status only. Bilingual (en/fr) strings added. `@nzila/sage-core`
> gains `listWorkspaces`/`getSageWorkspace`/`listSageWorkspaces`. Boundaries unchanged; still not launched,
> available, or procurement-ready.

## 4. Definition of world-class SAGE

World-class SAGE requires all of the following:

- secure workspace architecture
- role-based access control
- tenant / organization boundary design
- evidence source register
- evidence item lifecycle
- provenance tracking
- confidence / source-quality notation
- authorized-only handling
- exclusion handling
- human-review workflow
- decision-record support
- boundary warnings
- audit log
- export controls
- bilingual readiness
- accessibility readiness
- privacy / minimization posture
- no automated conclusions
- no scoring or ranking
- no unsupported certification / validation claims
- full test coverage for core flows
- documentation aligned with CIVIC / CLEAR / SAGE doctrine

SAGE is world-class only when it is technically implemented, operationally controlled, and doctrinally
bounded.

## 5. World-class implementation scorecard

| Category | World-class requirement | Minimum score to pass | Current status | Implementation notes |
| --- | --- | --- | --- | --- |
| Architecture and domain model | Repo-native entities, migrations, and boundaries defined and built | 9/10 | Not implemented — blueprint only | Adapt to `migrations/` raw-SQL + `sage_` prefix |
| Authorization and tenancy | `packages/platform-auth` permissions + `org_id` tenancy enforced in every service | 9/10 | Not implemented — blueprint only | Reuse `hasPermission` / role model |
| Evidence lifecycle | Source + item lifecycle with classification and exclusion | 9/10 | Not implemented — blueprint only | Lifecycle defined in §13 |
| Provenance and auditability | Every material action emits a `packages/audit` entry | 9/10 | Not implemented — blueprint only | Reuse hash-chained `AuditEntry` |
| Boundary controls | Boundary flags + no-conclusion enforcement | 9/10 | Not implemented — blueprint only | Boundaries in §6 |
| Human-review workflow | Named-reviewer gate before any decision record | 9/10 | Not implemented — blueprint only | Controls in §17 |
| Export controls | Export gated behind explicit approval | 9/10 | Not implemented — blueprint only | Reuse `packages/platform-export` |
| Accessibility | WCAG-aware, keyboard-navigable UI | 9/10 | Not implemented — blueprint only | §19 |
| Bilingual readiness | en-CA / fr-CA copy via `messages/*.json` | 9/10 | Not implemented — blueprint only | Reuse next-intl + `canadian-vocabulary` |
| Test coverage | Vitest coverage of core flows + contract tests | 9/10 | Not implemented — blueprint only | Colocated `*.test.ts` |
| Documentation consistency | Docs match implementation; `validate:docs` clean | 9/10 | Not implemented — blueprint only | Blueprint is the starting point |
| Operational validation | `final:go` remains certified with SAGE gates added | 9/10 | Not implemented — blueprint only | §23 gates |

SAGE is not world-class unless every category is at least 9/10 and no critical boundary, security, privacy,
authorization, export-control, accessibility, bilingual, test-coverage, or auditability gap remains.

## 6. Non-negotiable boundaries

SAGE must not:

- make institutional decisions
- score or rank institutions
- certify readiness
- validate legal, regulatory, procedural, clinical, tribunal, or compliance conclusions
- replace records systems
- replace accountable human review
- ingest restricted records by default
- imply procurement readiness before launch approval
- imply public availability before launch approval

## 7. Core product thesis

SAGE gives institutions a structured workspace for turning scattered continuity, implementation, governance,
and accountability evidence into reviewable institutional memory.

The value is not automation of judgment. The value is disciplined organization, traceability, review
readiness, and continuity under change.

## 8. Repo convention findings

Findings from inspecting the `nzila-os` monorepo. Where a convention is unclear, it is marked for Phase 1
engineering discovery rather than assumed.

| Area | Observed convention | Implication for SAGE |
| --- | --- | --- |
| Routing | Next.js App Router. `apps/platform-admin/app/` uses flat feature dirs (`app/governance`, `app/decisions`, `app/knowledge`) with API routes under `app/api/...`. platform-admin has no `[locale]` segment; other apps (union-eyes, cfo) do. | SAGE admin surface lives under `apps/platform-admin/app/sage/...`, not a fabricated `/admin/sage` app. Adapt candidate routes accordingly. |
| Protected/admin surfaces | platform-admin is the protected admin app; auth via `app/api/auth/[...nextauth]` plus `packages/platform-auth` (Clerk + Entra adapters). | SAGE surfaces are admin-gated in platform-admin using existing auth, not a new auth stack. |
| Persistence / data model | Raw PostgreSQL SQL in `migrations/` (numbered `0031_*` and dated `20260716_*`), snake_case tables, enums via `CREATE TYPE ... AS ENUM`, idempotent `DO $$ ... EXCEPTION WHEN duplicate_object` blocks, prefix-namespaced names (`ii_observatory_*`). | SAGE tables use a `sage_` prefix, snake_case, `sage_*_*` enums, idempotent migrations, and an `org_id` tenancy column. |
| Authorization / roles | `packages/platform-auth` exposes `hasPermission` / `hasAllPermissions` / `hasAnyPermission`, module `requiredRoles`, `userRole`, and permission-string checks. | SAGE defines permission strings (e.g. `sage.workspace.create`) and required roles enforced through platform-auth; it does not invent an RBAC engine. Exact platform role enum values require Phase 1 confirmation. |
| Audit logging | `packages/audit` provides a hash-chained tamper-evident log: `AuditEntry { actorId, orgId, action, resource, resourceId, payload, prevHash, hash, traceId, spanId }`, root-hash snapshots, and chain verification. | SAGE emits audit entries through `packages/audit` with `action` strings like `sage.workspace.created`; it does not create a parallel audit table. |
| Localization | `apps/platform-admin/messages/{en,en-CA,fr,fr-CA}.json` (next-intl style). `packages/canadian-vocabulary` holds bilingual terminology + validator. | SAGE copy is keyed in `messages/*.json`; CIVIC/CLEAR/SAGE terminology is registered via `canadian-vocabulary`. No hard-coded public-facing strings. |
| Testing | Vitest (`test:fast => vitest run`, `contract-tests` project). Tests colocated as `*.test.ts` beside source (e.g. `packages/audit/src/engine.test.ts`). | SAGE ships colocated `*.test.ts` for services, permission checks, audit emission, lifecycle, and export gating, plus contract tests where cross-package. |
| Docs validation | `validate:docs => tsx packages/platform-validation/src/doc-consistency.ts`; `final:go => node tooling/scripts/validate-final-go-status.mjs`; pre-commit brand-leakage + link-check hooks. | SAGE docs must pass `validate:docs`, keep `final:go` certified, and satisfy brand-leakage/link-check. |
| Reusable packages | `packages/org` (org/tenancy context), `packages/evidence`, `packages/platform-evidence-pack`, `packages/platform-export`, `packages/platform-governance`, `packages/platform-change-management`. | Phase 1 must decide reuse vs. new `packages/sage-core`; prefer composing existing `audit`, `platform-auth`, `org`, and `platform-export`. |

Uncertain and deferred to Phase 1 engineering discovery: exact platform role enum values; whether SAGE
persistence should be a new `sage_*` migration set or composed onto an existing evidence/governance schema;
whether `packages/evidence` (currently thin) is the right host or a new `packages/sage-core` is warranted.

## 9. Public-institution stakeholder and access model

SAGE RBAC must be aligned to public-institution reality, not only generic software administration.

The access model must account for the stakeholder groups that may participate in continuity, implementation,
evidence, governance, accountability, review, privacy, records, accessibility, language, and
change-management work across public institutions.

SAGE must support role-based access without assuming that every stakeholder should see every workspace,
source, evidence item, note, boundary flag, decision record, or export request.

| Stakeholder group | Typical public-institution function | Possible SAGE access need | Default access posture | Boundary notes |
| --- | --- | --- | --- | --- |
| Executive sponsor / accountable authority | Owns outcome and accountability | Overview, decisions | Workspace-scoped, read-weighted | No evidence editing by default |
| Senior responsible owner | Owns delivery | Overview, questions, decisions | Workspace-scoped | No export by default |
| Program or service owner | Runs the program/service | Evidence, questions | Workspace-scoped | Contributor, not approver |
| Change-management lead | Leads change work | Overview, evidence, questions | Workspace-scoped | Primary reviewer context |
| Policy lead | Owns policy framing | Evidence, notes | Workspace-scoped | No decision automation |
| Governance / secretariat lead | Coordinates governance | Overview, decisions, audit | Workspace-scoped | Records discipline |
| Evidence steward | Curates and classifies evidence | Sources, classification | Workspace-scoped | Classify before use |
| Evidence contributor | Adds evidence | Add evidence | Workspace-scoped | Cannot approve for decisions |
| Internal reviewer | Reviews evidence and notes | Review, notes | Workspace-scoped | No external sharing |
| Legal counsel | Legal risk review | Notes, flags | Restricted to assigned items | No validation claims |
| Privacy / access-to-information lead | Privacy/ATIP control | Flags, restrictions | Cross-cutting restrict | May block evidence use |
| Records / information-management lead | Records governance | Provenance, retention | Cross-cutting | Retention posture |
| Security / cyber / IT lead | Security review | Security flags | Cross-cutting restrict | May flag sensitive material |
| Accessibility lead | Accessibility review | Accessibility evidence | Workspace-scoped | WCAG evidence |
| Official Languages lead | Bilingual review | Language evidence | Workspace-scoped | en/fr parity |
| Equity / GBA Plus / inclusion lead | Equity review | Notes | Workspace-scoped | No scoring |
| Indigenous relations / partnership lead (where applicable) | Relationship stewardship | Relationship-led access | Protocol-respecting | No assumed authority/data |
| Communications / public affairs lead | Public communication | Overview | Read-weighted | No external sharing |
| Evaluation / audit / performance lead | Evaluation and audit | Overview, audit trail | Read-weighted | No auto-scoring |
| Front-line operations representative | Operational reality input | Questions, notes | Workspace-scoped | Contributor |
| Technology / systems owner | Systems ownership | Provenance context | Workspace-scoped | Not system of record |
| External advisor or reviewer | External reaction | Scoped read/comment | Disabled by default | Time-bound, export-disabled |
| Platform administrator | Platform operation | Administration | Platform-level | No automatic sensitive-evidence access |
| Organization administrator | Org operation | User/settings management | Org-scoped | No automatic export approval |

Default access posture:

- least privilege
- workspace-scoped by default
- evidence-level sensitivity controls
- authorized-only marking
- export disabled unless explicitly approved
- external reviewer access disabled by default
- no access to excluded evidence in external review contexts

### Institution-type-specific stakeholder extensions

The access model must also support stakeholder extensions by institution type, based on the
Public-Institution Adaptation Framework.

Reference: [Public-Institution Adaptation Framework](public-institution-adaptation-framework.md).

| Institution type / risk surface | Additional stakeholder access considerations | Default SAGE posture |
| --- | --- | --- |
| Department / ministry | deputy-level accountability, policy, program, communications, records, privacy, accessibility, language | governance and implementation evidence only; no decision automation |
| Crown corporation | board / executive sponsor, corporate secretary, service owner, risk, audit, public affairs | mandate and continuity evidence; no corporate decision scoring |
| Regulator | regulatory policy, guidance, records, legal, privacy, accessibility | exclude investigation, enforcement, inspection, licensing, adjudicative, and regulated-entity case materials |
| Tribunal / ombuds / accountability office | public guidance, service pathway, accessibility, records, privacy | exclude complaint files, investigation files, protected disclosures, evidence records, findings, reasons, recommendations, remedies, and case outcomes |
| Public broadcaster / cultural institution | change management, accessibility, language, governance, service/public mandate evidence | exclude editorial, journalistic, creative, programming, source-protection, newsroom, and ombudsman-process materials unless separately authorized and reviewed |
| Health / public health | privacy, records, clinical governance, security | deferred; no PHI, patient data, clinical records, or health-system readiness claim without separate approved phase |
| Education | student services, accessibility, privacy, records, program administration | exclude individual student records and adjudicative/disciplinary materials unless separately authorized |
| Elections / democratic institutions | public guidance, accessibility, continuity, security, records | exclude electoral decisions, voter records, enforcement, investigations, and operationally sensitive security materials |
| Police / enforcement / corrections | public-service pathway, policy, accessibility, records | exclude operational files, investigations, intelligence, enforcement decisions, detention/parole/case materials |
| Indigenous governments / institutions / service organizations | relationship lead, protocol lead, service owner, governance lead | relationship-led, protocol-respecting access; no assumption of authority, data access, or standard institutional framing |

### Access-design implication

SAGE must support both broad institutional roles and narrow domain-sensitive restrictions. A user may be
allowed into a workspace while still being blocked from specific evidence items, source classes, notes,
decision records, or export functions.

RBAC alone is not enough. SAGE also requires evidence-level authorization, source-level classification,
export-level approval, and boundary-aware review controls.

## 10. User roles, stakeholder mapping, and permission model

SAGE roles must map public-institution stakeholders into enforceable permissions.

The implementation should distinguish between:

1. **Institutional stakeholder identity** — the person's real-world function.
2. **SAGE application role** — what the person can do in the workspace.
3. **Evidence authorization level** — what sensitivity class the person may access.
4. **Export authority** — whether the person can request, review, approve, or deny external outputs.

Candidate SAGE application roles: Platform admin, Organization admin, Workspace owner, Evidence steward,
Evidence contributor, Internal reviewer, Decision-record approver, Privacy / records reviewer, Security
reviewer, Accessibility / language reviewer, Read-only observer, External reviewer (disabled by default).

| SAGE role | Typical stakeholder mappings | Can create workspace | Can add evidence | Can classify evidence | Can mark authorized-only | Can review | Can approve decision records | Can request export | Can approve export | Can administer users | Boundary notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform admin | Platform administrator | Yes | No | No | No | No | No | No | No | Yes | No automatic sensitive-evidence access |
| Organization admin | Organization administrator | Yes | No | No | No | No | No | No | No | Org-scoped | No automatic export approval |
| Workspace owner | Senior responsible owner, service owner | Yes | Yes | No | No | Yes | No | Yes | No | No | Cannot override sensitivity rules |
| Evidence steward | Evidence steward, records lead | No | Yes | Yes | Yes | No | No | No | No | No | Classifies sources/items |
| Evidence contributor | Program owner, front-line rep | No | Yes | No | No | No | No | No | No | No | Proposes; cannot approve |
| Internal reviewer | Change-management lead, policy lead | No | No | No | No | Yes | No | No | No | No | No external sharing |
| Decision-record approver | Accountable authority, governance lead | No | No | No | No | Yes | Yes | No | No | No | Named human required |
| Privacy / records reviewer | Privacy/ATIP lead, records lead | No | No | No | Yes | Yes | No | No | No | No | May block/restrict evidence |
| Security reviewer | Security / cyber / IT lead | No | No | No | Yes | Yes | No | No | No | No | Flags security-sensitive material |
| Accessibility / language reviewer | Accessibility lead, Official Languages lead | No | No | No | No | Yes | No | No | No | No | Reviews a11y + bilingual evidence |
| Read-only observer | Executive sponsor, communications | No | No | No | No | No | No | No | No | No | View only |
| External reviewer (disabled by default) | External advisor or reviewer | No | No | No | No | Comment-only | No | No | No | No | Explicitly approved, scoped, time-bound, export-disabled |

Required permission rules:

- Platform admins may administer the platform but should not automatically access all sensitive workspace
  evidence.
- Organization admins may manage users and workspace settings but should not automatically approve exports.
- Workspace owners may coordinate the workspace but must not override evidence sensitivity rules.
- Evidence stewards may classify sources and evidence items.
- Evidence contributors may propose or add evidence but not approve it for decision-record use.
- Internal reviewers may review evidence and notes but cannot approve external sharing unless separately
  assigned.
- Decision-record approvers must be named humans.
- Privacy / records reviewers must be able to block or restrict evidence use.
- Security reviewers must be able to flag security-sensitive materials.
- Accessibility / language reviewers may review accessibility and bilingual-readiness evidence.
- Read-only observers cannot export, edit, classify, or approve.
- External reviewer access is disabled by default and must be explicitly approved, scoped, time-bounded, and
  export-disabled.

**Evidence authorization levels:**

| Authorization level | Who may access | Can be used in decision record? | Can be exported? | Notes |
| --- | --- | --- | --- | --- |
| Public | Any workspace member | Yes, with provenance | Gated | Provenance still required |
| Administrative | Workspace-authorized | Yes | Gated | Requires workspace authorization |
| Internal | Role-scoped | Yes, role-scoped | Gated | Role-scoped access |
| Authorized-only | Explicitly authorized, marked | Only after review | Gated | Must be clearly marked |
| Sensitive | Additional review required | Only after additional review | Restricted | Extra review before use |
| Excluded | Authorized internal only | No | No | Not usable in external review output |

Rules:

- Public evidence may be linked broadly but still requires provenance.
- Administrative evidence requires workspace authorization.
- Internal evidence requires role-scoped access.
- Authorized-only evidence requires explicit authorization and must be clearly marked.
- Sensitive evidence requires additional review before use.
- Excluded evidence may remain visible only to authorized internal users but cannot be used in external
  review outputs.

**Export authority levels:** No export access, Can request export, Can review export, Can approve export,
Can deny export, Platform emergency hold.

No single role should automatically have unrestricted export authority by default.

## 11. Core domain model

Candidate entities (repo-native `sage_` snake_case tables; TypeScript types in PascalCase):

| Entity | Purpose | Required fields | Boundary notes |
| --- | --- | --- | --- |
| SageWorkspace | Container for an institution's evidence work | id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by, updated_by | org-scoped; no cross-org read; institution context required |
| SageWorkspaceMember | Records workspace membership | id, workspace_id, actor_id, created_by | membership only; not a permission grant |
| SageEvidenceSource | Registered source of evidence | id, workspace_id, source_type, source_quality, authorization_level, contains_personal_information, contains_sensitive_information | classify before use |
| SageEvidenceItem | A discrete piece of evidence | id, source_id, workspace_id, lifecycle_state, confidence_level, excluded_from_external_review, human_review_required | lifecycle in §13 |
| SageEvidenceLink | Relationship between items/questions | id, workspace_id, from_id, to_id, link_type | no inferred conclusions |
| SageOpenQuestion | Tracked unresolved question | id, workspace_id, question, status, created_by | readiness signal, not a finding |
| SageBoundaryFlag | Explicit boundary/risk marker | id, workspace_id, target_id, flag_type, note, created_by | surfaces prohibited uses |
| SageReviewNote | Human review commentary | id, workspace_id, target_id, reviewer_id, note | reviewer named |
| SageDecisionRecord | Recorded internal decision | id, workspace_id, decision, rationale, human_reviewer_id, created_by | requires named reviewer |
| SageExportRequest | Request to export material | id, workspace_id, requested_by, status, approver_id, decision_at | gated; default denied |
| SageStakeholderProfile | Institutional stakeholder identity and function | id, actor_id, org_id, stakeholder_function, institution_type_context | maps real-world function |
| SageRoleAssignment | SAGE application role granted to a user | id, workspace_id, actor_id, sage_application_role, workspace_scope, time_bound_access_expires_at, access_reason, approved_by | user-to-workspace authorization |
| SageEvidenceAuthorization | Per-user evidence authorization grant | id, workspace_id, actor_id, evidence_authorization_level, approved_by, access_reason | user-to-evidence authorization |
| SageExportApproval | Export authority decision | id, export_request_id, export_authority_level, approver_id, decision, decision_at | user-to-export authorization |
| SageAuditEvent | Reference to the emitted audit entry | audit entry via `packages/audit` | not a parallel log |

Required boundary fields across the model (adapt names to migration conventions):

- `source_type`
- `source_quality`
- `confidence_level`
- `authorization_level`
- `contains_personal_information`
- `contains_sensitive_information`
- `excluded_from_external_review`
- `human_review_required`
- `created_by`
- `updated_by`
- `audit_event_id` (or audit correlation via `packages/audit` `resourceId`)

Stakeholder- and authorization-specific fields (from the access model in §9 and §10):

- `stakeholder_function`
- `institution_type_context`
- `sage_application_role`
- `workspace_scope`
- `evidence_authorization_level`
- `export_authority_level`
- `time_bound_access_expires_at`
- `access_reason`
- `approved_by`

Authorization boundary rule: access is not only user-to-workspace. SAGE must support user-to-workspace,
user-to-evidence, user-to-export, and user-to-decision-record authorization.

Membership vs. role-assignment rule: `SageWorkspaceMember` records workspace membership. `SageRoleAssignment`
records one or more enforceable SAGE application roles for that member. A user must have membership before a
role assignment is valid. Authorization checks must resolve through role assignments, not through membership
alone — membership alone must not grant evidence, decision-record, or export permissions.

Institution-context rule: every SAGE workspace must declare an institution type and risk surface before
evidence can be classified or linked. Boundary defaults (`boundary_profile`) are derived from that institution
type and risk surface, per the Public-Institution Adaptation Framework.

## 12. Workspace surfaces

| Surface | User purpose | Minimum implementation | Boundary requirement |
| --- | --- | --- | --- |
| Workspace overview | See status, gaps, open questions | Read view + counts | No scores or rankings |
| Evidence sources | Register and classify sources | List + create + classify | Classification required before use |
| Evidence items | Manage evidence lifecycle | List + create + state transitions | Authorized-only marked before linking |
| Open questions | Track unresolved questions | List + create + status | Questions are not findings |
| Boundary flags | Surface prohibited/risky uses | List + create | Visible to reviewers |
| Review notes | Capture human review | List + create (named reviewer) | Reviewer identity required |
| Decision records | Record internal decisions | Create with named reviewer | No record without human review |
| Export controls | Request/approve/deny export | Gated workflow | Default denied |
| Audit trail | View material actions | Read-only from `packages/audit` | Tamper-evident |
| Settings / permissions | Manage members and roles | Role assignment | Admin-gated |

## 13. Evidence lifecycle

`Proposed → Registered → Classified → Linked → Reviewed → Accepted / Needs review / Excluded → Archived`

Rules:

- evidence starts as Proposed
- source classification is required before use
- authorized-only material must be marked before linking
- excluded material remains visible internally but cannot be used in external review output
- human review is required before any decision record references evidence

## 14. CLEAR integration

| CLEAR dimension | SAGE support |
| --- | --- |
| Continuity | workspace memory, source register, open questions |
| Legitimacy | authority/source context, provenance, role visibility |
| Evidence | evidence item lifecycle, source quality, confidence |
| Accountability | decision records, review notes, audit trail |
| Readiness | gaps, unresolved questions, boundary flags |

CLEAR remains the method. SAGE is the workspace that helps operate the method.

## 15. CIVIC integration

| CIVIC element | SAGE support |
| --- | --- |
| Continuity | institutional memory and evidence continuity |
| Implementation | change-work evidence and open-question tracking |
| Visibility | reviewable workspace surfaces |
| Integrity | provenance, boundary flags, audit trail |
| Capacity | reusable workflows and disciplined evidence handling |

## 16. Auditability and provenance

Every material action in SAGE must create an audit event through `packages/audit`:

- workspace created
- member added / removed
- evidence source created
- evidence item created
- classification changed
- authorization level changed
- boundary flag added
- review note added
- decision record created
- export requested
- export approved / denied

Audit entries are hash-chained and verifiable via the existing `packages/audit` root-hash snapshot and
verification flow; SAGE must not create a parallel, non-tamper-evident log.

## 17. Human-review controls

SAGE must preserve accountable human review at every point where evidence could influence interpretation.

Required controls:

- no auto-generated findings
- no auto-score
- no auto-certification
- no auto-export
- no decision record without named human reviewer
- no external sharing without explicit approval

## 18. Security, privacy, and records posture

- role-based access
- least privilege
- tenant / organization boundary (`org_id`)
- personal-information minimization
- sensitive-information flag
- authorized-only marker
- export gating
- audit log
- retention posture documented before launch
- no assumption that SAGE is a system of record

## 19. Accessibility and bilingual readiness

- WCAG-aware UI implementation
- keyboard navigability
- visible focus states
- semantic headings
- English/French copy architecture via `messages/{en,en-CA,fr,fr-CA}.json`
- no hard-coded public-facing strings
- bilingual terminology register for CIVIC / CLEAR / SAGE via `packages/canadian-vocabulary`

## 20. Data model candidates

Implementation-oriented, adapted to raw-SQL migration conventions (`sage_` prefix, snake_case, idempotent
enums). Indexes and validation are candidates for Phase 1 confirmation.

| Model | Fields | Required indexes | Validation rules | Notes |
| --- | --- | --- | --- | --- |
| sage_workspace | id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by, updated_by, created_at, updated_at | (org_id), (org_id, status), (institution_type) | name + institution_type + risk_surface required; status in enum | org-scoped root; boundary defaults derived from institution_type + risk_surface |
| sage_evidence_source | id, workspace_id, org_id, source_type, source_quality, authorization_level, contains_personal_information, contains_sensitive_information, created_by | (workspace_id), (workspace_id, authorization_level) | source_type + authorization_level required | classify before use |
| sage_evidence_item | id, source_id, workspace_id, org_id, lifecycle_state, confidence_level, excluded_from_external_review, human_review_required, created_by, updated_by | (workspace_id, lifecycle_state), (source_id) | lifecycle_state in enum; source classified | lifecycle §13 |
| sage_boundary_flag | id, workspace_id, org_id, target_id, flag_type, note, created_by | (workspace_id), (target_id) | flag_type in enum | visible to reviewers |
| sage_decision_record | id, workspace_id, org_id, decision, rationale, human_reviewer_id, created_by, created_at | (workspace_id) | human_reviewer_id required | no record without reviewer |
| sage_workspace_member | id, workspace_id, org_id, actor_id, created_by, created_at | (workspace_id), (actor_id) | membership required before role assignment | membership is not permission |
| sage_stakeholder_profile | id, org_id, actor_id, stakeholder_function, institution_type_context, created_by, updated_by | (org_id, actor_id) | stakeholder_function required | maps real-world function |
| sage_role_assignment | id, workspace_id, org_id, actor_id, sage_application_role, workspace_scope, time_bound_access_expires_at, access_reason, approved_by | (workspace_id, actor_id), (sage_application_role) | membership required; role valid | enforceable application role |
| sage_evidence_authorization | id, workspace_id, org_id, actor_id, evidence_authorization_level, access_reason, approved_by | (workspace_id, actor_id), (evidence_authorization_level) | level valid; approver required | user-to-evidence authorization |
| sage_export_request | id, workspace_id, org_id, requested_by, scope, status, created_at | (workspace_id), (status) | default denied | export request, not approval |
| sage_export_approval | id, export_request_id, org_id, export_authority_level, approver_id, decision, decision_at, reason | (export_request_id), (approver_id) | approver cannot be requester | user-to-export authorization |
| sage_audit_event | correlation to `packages/audit` entry (resource=`sage_*`, resourceId=entity id) | via audit store | actorId + orgId + action required | reuse audit package |

Enums (candidate, idempotent `DO $$` blocks): `sage_evidence_lifecycle`, `sage_source_type`,
`sage_source_quality`, `sage_authorization_level`, `sage_confidence_level`, `sage_boundary_flag_type`,
`sage_workspace_status`, `sage_export_status`, `sage_institution_type`, `sage_risk_surface`.

Workspace boundary-profile usability rule: a SAGE workspace is not usable until `institution_type`,
`risk_surface`, and `boundary_profile` are present. Evidence source creation, evidence item creation,
linking, decision records, and exports must be blocked until the workspace has a valid boundary profile.

## 21. API / service layer candidates

Service functions adapted to repo service conventions (typed functions in a `sage-core` package or composed
onto existing packages; each enforces `platform-auth` permission and emits a `packages/audit` entry).

| Service | Inputs | Auth required | Audit event | Boundary validation |
| --- | --- | --- | --- | --- |
| createSageWorkspace | org_id, name, institution_type, risk_surface, actor | sage.workspace.create | sage.workspace.created | org scope; institution_type + risk_surface required; boundary_profile derived before workspace is usable |
| addSageWorkspaceMember | workspace_id, actor_id, role | sage.member.manage | sage.member.added | role valid |
| assignSageRole | workspace_id, actor_id, sage_application_role, scope, access_reason, approved_by | sage.role.assign | sage.role.assigned | membership required; role valid; approver required |
| revokeSageRole | workspace_id, actor_id, sage_application_role, revoked_by, reason | sage.role.revoke | sage.role.revoked | membership remains but role permission removed |
| grantSageEvidenceAuthorization | workspace_id, actor_id, evidence_authorization_level, access_reason, approved_by | sage.evidence_authorization.grant | sage.evidence_authorization.granted | membership required; level valid; approver required |
| revokeSageEvidenceAuthorization | workspace_id, actor_id, evidence_authorization_level, revoked_by, reason | sage.evidence_authorization.revoke | sage.evidence_authorization.revoked | access removed; audit required |
| setSageExportAuthority | workspace_id, actor_id, export_authority_level, access_reason, approved_by | sage.export_authority.set | sage.export_authority.set | no unrestricted default; approver required |
| createSageEvidenceSource | workspace_id, source_type | sage.evidence.create | sage.evidence_source.created | classification pending; workspace boundary profile required |
| classifySageEvidenceSource | source_id, source_quality, authorization_level | sage.evidence.classify | sage.source.classified | required before use |
| createSageEvidenceItem | source_id, fields | sage.evidence.create | sage.evidence_item.created | source classified |
| linkSageEvidenceItem | from_id, to_id, link_type | sage.evidence.link | sage.evidence.linked | authorized-only marked |
| addSageBoundaryFlag | target_id, flag_type, note | sage.boundary.flag | sage.boundary.flagged | flag_type valid |
| addSageReviewNote | target_id, note, reviewer_id | sage.review.note | sage.review.noted | reviewer named |
| createSageDecisionRecord | decision, rationale, human_reviewer_id | sage.decision.record | sage.decision.recorded | human reviewer required |
| requestSageExport | workspace_id, scope | sage.export.request | sage.export.requested | default denied |
| approveSageExport | export_id, approver_id | sage.export.approve | sage.export.approved | approver ≠ requester |
| denySageExport | export_id, approver_id, reason | sage.export.approve | sage.export.denied | reason required |
| getSageWorkspaceSummary | workspace_id | sage.workspace.read | (read; no audit) | no scores/rankings |

Workspace creation requires `institution_type` and `risk_surface`; `boundary_profile` is derived from them
before the workspace is usable. Evidence source creation, evidence item creation, linking, decision records,
and exports must be blocked until the workspace has a valid boundary profile.

## 22. UI implementation candidates

Adapted to the real platform-admin App Router convention (flat feature dir under `apps/platform-admin/app/`,
API under `app/api/`), not a fabricated `/admin/sage` app. Candidate routes:

- `apps/platform-admin/app/sage` — workspace list
- `apps/platform-admin/app/sage/[workspaceId]` — workspace overview
- `apps/platform-admin/app/sage/[workspaceId]/sources` — evidence sources
- `apps/platform-admin/app/sage/[workspaceId]/evidence` — evidence items
- `apps/platform-admin/app/sage/[workspaceId]/questions` — open questions
- `apps/platform-admin/app/sage/[workspaceId]/flags` — boundary flags
- `apps/platform-admin/app/sage/[workspaceId]/reviews` — review notes
- `apps/platform-admin/app/sage/[workspaceId]/decisions` — decision records
- `apps/platform-admin/app/sage/[workspaceId]/exports` — export controls
- `apps/platform-admin/app/sage/[workspaceId]/audit` — audit trail
- `apps/platform-admin/app/sage/[workspaceId]/settings` — settings / permissions
- `apps/platform-admin/app/api/sage/...` — server route handlers

Adaptation note: the original `/admin/sage/*` candidate is mapped onto platform-admin because platform-admin
*is* the protected admin surface; there is no separate `/admin` route prefix in this repo. If Phase 1 finds
SAGE belongs in a different app, the route base is revised then.

## 23. Validation and test gates

- Typecheck (`turbo typecheck`)
- Unit tests (Vitest)
- Permission tests (platform-auth integration)
- Audit-event tests (audit emission per action)
- Evidence lifecycle tests
- Export-control tests
- Stakeholder-to-role mapping tests
- Evidence authorization tests
- External reviewer disabled-by-default tests
- Export authority separation tests
- Sensitive evidence exclusion tests
- Institution-type boundary tests
- Negative authorization tests
- Negative export-control tests
- Negative boundary-invariant tests
- Requester-cannot-approve-own-export test
- Platform-admin-no-automatic-sensitive-evidence-access test
- Org-admin-no-automatic-export-approval test
- External-reviewer-no-export test
- Boundary-copy scan
- SAGE productization scan
- Accessibility smoke test
- Bilingual string check (`messages/*.json` parity)
- Docs validation (`validate:docs`)
- `final:go`

SAGE cannot be considered world-class unless stakeholder access, evidence authorization, and export authority
are tested separately.

### Implementation-blocking invariants

SAGE implementation must fail validation if any of these invariants are violated:

- workspace exists without `org_id`
- workspace exists without `institution_type`
- workspace exists without `risk_surface`
- workspace exists without `boundary_profile`
- workspace member has permissions without role assignment
- role assignment exists without workspace membership
- evidence item is linked before source classification
- authorized-only evidence is linked without explicit authorization
- sensitive evidence is used without additional review
- excluded evidence appears in an external-review output
- decision record exists without named human reviewer
- export approval is granted by the requester
- external reviewer has export authority
- platform admin automatically receives sensitive evidence access
- organization admin automatically receives export approval
- audit event is missing for a material action

## 24. Implementation phases

| Phase | Objective | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| Phase 1 — Architecture lock, stakeholder access model, and domain model | Confirm repo-native persistence, auth, and audit integration; lock the stakeholder access model; define `sage_*` schema | Stakeholder/access model aligned to the Public-Institution Adaptation Framework; SAGE application role model; evidence authorization levels; export authority model; domain entities for stakeholder role assignments and evidence authorization; migration(s) for core `sage_*` tables/enums; TypeScript entity types; permission-string list; audit-event contract for access and authorization changes; architecture note; schema/validation tests | See Phase 1 hard exit gate below |
| Phase 2 — Core services and audit events | Build service functions with auth + audit | `createSageWorkspace`, evidence source/item services; audit emission; permission enforcement | Services enforce `org_id` + permissions; every material action emits an audit entry; unit tests pass |
| Phase 3 — Workspace UI shell | platform-admin `sage` route shell | Workspace list + overview routes; navigation; localized strings | Routes render; strings keyed in `messages/*.json`; auth-gated |
| Phase 4 — Evidence source and item lifecycle | Full source + item lifecycle | Create/classify/link/exclude flows; lifecycle state machine | Lifecycle rules enforced; exclusion respected; tests pass |
| Phase 5 — Boundary flags, review notes, decision records | Human-review controls | Flag/review/decision surfaces; named-reviewer gate | No decision record without named reviewer; boundary flags visible |
| Phase 6 — Export controls and approval workflow | Gated export | Request/approve/deny via `packages/platform-export`; approver ≠ requester | Export default denied; approval audited |
| Phase 7 — Accessibility, bilingual readiness, governance scans | Compliance hardening | WCAG checks; en/fr parity; SAGE productization + boundary scans | Accessibility smoke passes; string parity; scans clean |
| Phase 8 — End-to-end proof of implementation | Prove the workspace lifecycle | E2E flow: create workspace → register/classify evidence → flag → review → decision (human) → gated export | E2E passes; scorecard categories ≥ 9/10; `final:go` certified |

Phase 1 is engineering-oriented: it produces real migrations, types, and contracts — not documentation.

**Phase 1 hard exit gate.** Phase 1 cannot exit until:

- `sage_workspace` includes `org_id`, `institution_type`, `risk_surface`, and `boundary_profile`
- stakeholder/access model tables are defined
- membership and role assignment are separate
- evidence authorization levels are represented
- export authority levels are represented
- audit-event contract covers access, authorization, evidence, decision, and export actions
- negative authorization/export tests exist or are explicitly queued with a blocking TODO
- typecheck and tests pass

## 25. Definition of done

SAGE is fully implemented only when:

- core domain model exists
- services enforce authorization and boundary validation
- UI supports the core workspace lifecycle
- evidence sources and evidence items can be created, classified, reviewed, and excluded
- decision records require human review
- export requests are gated
- audit events exist for material actions
- boundary scans pass
- accessibility and bilingual readiness are validated
- tests cover core flows
- docs match implementation
- `final:go` remains certified
- stakeholder groups are formally mapped
- SAGE roles are mapped to stakeholder functions
- evidence authorization levels are implemented
- export authority is separated from workspace administration
- external reviewer access is disabled by default
- institution-type boundary rules are represented in access controls
- tests cover stakeholder mapping, evidence authorization, external reviewer gating, and export authority
  separation

Until then, SAGE remains under implementation and must not be described externally as launched, available, or
procurement-ready.

## 26. Immediate next engineering task

Begin Phase 1: Architecture lock, stakeholder access model, and domain model.

**Next PR: implement SAGE stakeholder access model, domain model, and architecture lock.**

Required deliverables for the next PR:

- inspect existing auth/role conventions
- define repo-native stakeholder access model
- define SAGE role assignments
- define evidence authorization levels
- define export authority levels
- define core `SageWorkspace` entities
- define audit event contract for access and evidence actions
- add schema validation or tests where applicable

The next PR after this blueprint must implement at least one repo-native engineering foundation for SAGE. It
must not be another planning-only artifact.

The next PR is not allowed to be docs-only.

The next PR must include at least one of:

- a repo-native migration
- TypeScript domain types
- permission constants/tests
- audit-event contract tests
- schema validation
- service-layer skeleton with tests

A documentation-only PR does not satisfy the next-step requirement.
