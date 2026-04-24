# UnionEyes — Pre-Deployment Operational Audit

**Date:** 2026-04-09  
**Scope:** UnionEyes (`apps/union-eyes`) readiness for real CUPE data ingestion  
**Principle:** _If real CUPE data is ingested tomorrow, the system must not break, lose data, or produce invalid cases._  
**Classification:** READ-ONLY AUDIT — no code changes

---

## Overall Readiness Score: 5.5 / 10

## Verdict: NOT READY — Critical blockers must be resolved before live CUPE data

---

## Section Scorecard

| # | Section | Score | Status |
|---|---------|-------|--------|
| 1 | Ingestion Entry Points | 7/10 | PARTIAL |
| 2 | Case Creation Validation | 7/10 | PARTIAL |
| 3 | FSM Lifecycle Reconstruction | 7/10 | PARTIAL |
| 4 | History & Timeline Integrity | 7/10 | PARTIAL |
| 5 | Document Ingestion | 4/10 | FAIL |
| 6 | Entity Linking & Referential Integrity | 3/10 | FAIL |
| 7 | RBAC During Ingestion | 7/10 | PARTIAL |
| 8 | Duplication & Idempotency | 2/10 | FAIL |
| 9 | Error Handling & Recovery | 5/10 | PARTIAL |
| 10 | Data Quality & Normalization | 7/10 | PARTIAL |
| 11 | Performance & Scale | 5/10 | PARTIAL |
| 12 | Audit & Traceability | 7/10 | PARTIAL |

---

## Section 1 — Ingestion Entry Points

**Score: 7/10 — PARTIAL**

### Inventory of Ingestion Paths

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 1 | `/api/cases/intake` | POST | Primary case intake with CUPE vocabulary validation |
| 2 | `/api/grievances` | POST | Grievance creation (Zod schema, authority gate) |
| 3 | `/api/documents/upload` | POST | Document upload (50 MB, MIME whitelist) |
| 4 | `/api/documents/bulk` | POST | Bulk document operations (move, tag, delete, OCR) |
| 5 | `/api/voice/upload` | POST | Azure OpenAI Whisper transcription |
| 6 | `/api/dues/remittances/upload` | POST | Employer remittance file upload |
| 7 | `/api/cba-intelligence/ingestion/*` | POST | CBA intelligence pipeline (seed → trigger → run) |

### Findings

- **Case Intake** (`/api/cases/intake`): Validates via `validateIntakeRequest()` from `@nzila/cupe-vocabulary`. Required fields: memberId, caseType, priority, title, description, incidentDate, location. Uses RLS context transaction. Calls `auditDataMutation()` and `buildUnionEvidencePack()`. Evidence pack failure is **non-blocking** (warning only).
- **Grievance Creation** (`/api/grievances`): Zod schema validates 11 grievance type enums, title (5–500 chars), description (min 10). Authority gate: members create in `draft` status only; steward+ can create in `filed`. RLS transaction inserts grievance + grievanceEvent atomically.
- **Document Upload** (`/api/documents/upload`): Multipart form, 50 MB limit, MIME whitelist. Validates org ID match with auth context.
- **CBA Pipeline** (`/api/cba-intelligence/ingestion/*`): Full pipeline (seed 17 sources → trigger jobs → run orchestrator). **Most mature ingestion path** — has content hash dedup via `computeContentHash()` + upsert pattern, per-document error tracking, and job status = "completed_with_errors".
- **No bulk import/migration endpoint exists** for ingesting thousands of existing CUPE cases.

### Gaps

- 🔴 No bulk case import API for existing CUPE data
- ⚠️ No idempotency on any case/grievance endpoint (Section 8)
- ⚠️ Evidence pack failure is silently swallowed

---

## Section 2 — Case Creation Validation

**Score: 7/10 — PARTIAL**

### Findings

- **Zod Schema Enforcement**: Case intake and grievance creation both use strict Zod schemas with `.safeParse()` before DB insert. Type-safe error messages returned.
- **CUPE Vocabulary Validation**: `@nzila/cupe-vocabulary` provides domain-specific validation (case types, priority levels, etc.).
- **DB-Level Enums**: `pgEnum()` defines 16 grievance statuses, 11 types, 4 priorities at the database level — invalid values rejected by PostgreSQL.
- **Authority Gate**: Members can only create `draft` cases; `filed` requires steward+. Authority violations logged as `AUTHORITY_VIOLATION` audit event.
- **String Validation**: `zNonEmpty = z.string().trim().min(1)` — whitespace stripped. Titles: min 5, max 500. Descriptions: min 10.

### Gaps

- ⚠️ No phone number validation (fields exist without format check)
- ⚠️ No email format validation (`.email()` not applied to email fields)
- ⚠️ No name normalization (title-casing, whitespace collapsing)
- ⚠️ `incidentDate` parsed as `new Date(data.incidentDate)` — NaN if non-ISO input

---

## Section 3 — FSM Lifecycle Reconstruction

**Score: 7/10 — PARTIAL**

### Unified Case Lifecycle FSM

**File:** `lib/workflow/case-lifecycle.ts`

**10 States:** `draft` → `submitted` → `triage` → `investigation` → `pending_docs` → `negotiation` → `mediation` → `arbitration` → `resolved` → `closed`

**Transition Matrix:**

- Enforced at API layer — invalid transitions rejected
- Role-per-transition enforcement (member can submit; steward+ for triage; admin for close; system_admin to reopen)

**Guard Conditions:**

- Must assign steward before investigation
- Must have docs before resolution
- 7-day cooling-off period for reopen

**SLA Standards:** Defined per state+priority (e.g., triage: 24h for urgent, 72h for high)

### Gaps

- ⚠️ **Dual FSM** — Legacy `grievance-state-machine.ts` still exists (deprecated but imported). `state-bridge.ts` maps between legacy and unified FSM. Risk of state drift between systems.
- ⚠️ **FSM enforcement is API-layer only** — direct DB writes can bypass transitions
- ⚠️ No DB constraint preventing invalid state values beyond the pgEnum (the transition rules themselves are code-only)

---

## Section 4 — History & Timeline Integrity

**Score: 7/10 — PARTIAL**

### Event Tracking Tables

| Table | Purpose | Immutable |
|-------|---------|-----------|
| `grievanceEvents` | Lifecycle events (status changes, notes) | Not trigger-protected |
| `grievanceTransitions` | State transition history (from → to) | ✅ Trigger-protected |
| `grievanceApprovals` | Approval decisions | ✅ Trigger-protected |
| `claimUpdates` | Claim field change history | ✅ Trigger-protected |
| `auditLogs` | Cross-cutting audit trail | ✅ Archive-only updates |

### Findings

- **Append-Only Triggers** (migration `0064`): `reject_mutation()` prevents UPDATE/DELETE on grievanceTransitions, grievanceApprovals, claimUpdates, and votes. Audit logs allow archive-field-only updates.
- **Multi-Layer Recording**: Status changes create entries in grievanceEvents + grievanceTransitions + auditLogs simultaneously.
- **Evidence Packs**: `buildUnionEvidencePack()` creates tamper-proof records for critical transitions.

### Gaps

- ⚠️ **Backdating possible** — no validation prevents `createdAt` or `eventDate` from being set in the past
- ⚠️ **No explicit event deduplication** — replayed API calls create duplicate timeline entries
- ⚠️ `grievanceEvents` table NOT protected by immutability trigger (only transitions/approvals/claimUpdates are)
- ⚠️ No CASCADE on `grievanceTransitions.claimId` FK — orphan transitions if claim deleted

---

## Section 5 — Document Ingestion

**Score: 4/10 — FAIL**

### Findings

- **Upload**: 50 MB limit, MIME whitelist (PDF, images, Office docs, CSV). Validates org ID matches auth context.
- **Storage**: Documents stored in Azure Blob Storage with `organizationId` scoping.
- **Metadata**: Document record includes `organizationId`, `folderId`, `fileName`, `mimeType`, `sizeBytes`, `uploadedBy`.

### Critical Failures

- 🔴 **NO case/claim FK on documents table** — documents are org-scoped only, with zero database-level link to cases
- 🔴 **No join table** (`case_documents`) exists — no mechanism to associate a document with a specific case
- 🔴 `claims.attachments` is a JSONB array (untyped, no FK) — document references stored as opaque JSON
- ⚠️ No document versioning — re-upload creates new record, old version orphaned
- ⚠️ No idempotency — same file uploaded twice creates two records

---

## Section 6 — Entity Linking & Referential Integrity

**Score: 3/10 — FAIL**

### Critical Failures

- 🔴 **CRITICAL: `getClaimById()` has NO organizationId filter** (`db/queries/claims-queries.ts`) — any authenticated user can fetch any claim by ID regardless of organization. **Cross-org data leak.**
- 🔴 **`claims.organizationId` is NULLABLE** — claims can exist without organizational ownership, breaking multi-tenancy
- 🔴 **`defensibilityPacks.caseId` has no FK constraint** despite comment "References claims.claimId" — orphan packs possible
- 🔴 **No CASCADE on grievanceTransitions and grievanceAssignments** — deleting a claim orphans its entire transition and assignment history

### Foreign Key Analysis

| Relationship | FK Exists | CASCADE | Risk |
|---|---|---|---|
| claimUpdates → claims | ✅ | ✅ CASCADE | OK |
| grievanceTransitions → claims | ✅ | ❌ NONE | Orphan transitions |
| grievanceApprovals → claims | ✅ | ❌ NONE | Orphan approvals |
| defensibilityPacks → claims | ❌ NO FK | N/A | **Orphan packs** |
| documents → claims | ❌ NO FK | N/A | **No link at all** |
| grievanceAssignments → claims | ✅ | ❌ NONE | Orphan assignments |

### Additional Gaps

- ⚠️ `getClaimsByOrganization()` correctly filters by orgId — but the unfiltered `getClaimById()` creates an IDOR vulnerability
- ⚠️ No soft-delete — hard deletes leave orphans across multiple tables

---

## Section 7 — RBAC During Ingestion

**Score: 7/10 — PARTIAL**

### Role Hierarchy

```
member(0) → steward(1) → chief_steward(2) → officer(3) → admin(4) → system_admin/platform_admin(5)
```

### Findings

- **Action Enforcer** (`lib/action-enforcer.ts`): Maps actions to minimum role levels. `case_create` requires level 0 (member — by design).
- **API Auth Guard** (`lib/api-auth-guard.ts`): Enforces authentication on all API routes. Extracts userId, orgId from auth context.
- **RLS Context**: Database-level row-level security via `set_config('app.current_user_id', ...)`.
- **Authority Gate on Grievances**: Members create `draft` only; steward+ can create `filed`. Violations logged.

### Gaps

- ⚠️ **`createClaim()` has NO internal role check** — relies entirely on API layer; direct function call bypasses RBAC
- ⚠️ **`getClaimById()` has no org filter** (see Section 6) — renders RBAC meaningless for data reads
- ⚠️ No rate limiting on ingestion endpoints (DoS risk during bulk import)

---

## Section 8 — Duplication & Idempotency

**Score: 2/10 — FAIL**

### Unique Constraints

| Table | Unique Field | Dedup Mechanism |
|---|---|---|
| claims | `claimId` (uuid), `claimNumber` (seq) | ❌ None |
| grievances | `grievanceNumber` | ❌ None |
| arbitrations | `arbitrationNumber` | ❌ None |
| documents | None | ❌ None |
| settlements | None (FK only) | ❌ None |

### Patterns That Exist (Not Applied to Cases)

- ✅ **Integration Control Plane**: SHA-256 payload hash + 24h idempotency window — used for webhook/API push integrations only
- ✅ **Transaction Fee Engine**: Idempotency key check-before-insert — used for fee capture only
- ✅ **CBA Pipeline**: Content hash dedup via `computeContentHash()` — used for CBA intelligence only

### Critical Gaps

- 🔴 **No idempotency on claim/grievance creation** — every POST creates a new record
- 🔴 **No external ID reference tracking** — can't deduplicate on source system ID during migration
- 🔴 **No content hash on claims/documents** — replayed data creates duplicates
- 🔴 **No bulk upsert pattern** — no `ON CONFLICT ... DO UPDATE` for claims
- 🔴 **Claim creation uses `defaultRandom()` UUIDs** — every insert generates a new ID
- **Risk:** Bulk import retry → duplicate claims with unique claimNumbers. No way to detect or prevent.

---

## Section 9 — Error Handling & Recovery

**Score: 5/10 — PARTIAL**

### What Works

- ✅ **Transaction support**: Django uses `transaction.atomic()`; Drizzle uses `db.transaction()` for platform economics
- ✅ **Retry with exponential backoff**: Integration control plane (5s → 640s, 8 retries, dead letter queue)
- ✅ **Dead letter queue**: Integration failures after 8 retries → `integration_dead_lettered` event → manual review
- ✅ **Failure recording**: `consecutive_failures` + `failure_count` tracking with status progression (active → degraded → failed → paused/disabled)

### What Does NOT Apply to Case Ingestion

- ❌ **Retry logic NOT applied to claim ingestion** — single-attempt insert
- ❌ **No transaction wrapping for individual claim creation** — uses RLS context, not atomic block
- ❌ **No partial failure handling in batch operations** — one failure = entire batch fate unknown
- ❌ **No compensation/rollback** for partially completed imports
- ❌ **No circuit breaker** for cascading failures

**Risk:** Failed claim import leaves system in inconsistent state with no recovery path.

---

## Section 10 — Data Quality & Normalization

**Score: 7/10 — PARTIAL**

### Strengths

- ✅ **SQL Injection Prevention**: All routes use Drizzle ORM with parameterized queries. `sql` template literals auto-escape. RLS `set_config()` parameterized. **No injection gaps found.**
- ✅ **XSS Protection**: DOMPurify with strict whitelist (client-side). Server-side falls back to regex strip.
- ✅ **Enum Validation**: `pgEnum()` enforces at DB level. Zod `.enum()` replicates in API validation. Double-layer protection.
- ✅ **Date/Time**: ISO-8601 enforcement via `zDateTimeString` and `zDateString`. Timezone-aware columns (`timestamptz`). UTC normalization by PostgreSQL.
- ✅ **Currency**: `zMoneyString` enforces 2-decimal string format (`/^\d+\.\d{2}$/`). No floating-point precision issues.
- ✅ **Encoding**: UTF-8 explicit everywhere (file reading, encryption, XML generation).
- ✅ **Postal Code**: Canadian postal code regex validation.

### Gaps

- ⚠️ **No phone number validation** — fields exist without format check
- ⚠️ **No email format validation** — `.email()` not applied
- ⚠️ **No name normalization** — stored as-is (no title-casing, no whitespace collapsing)
- ⚠️ **Server-side HTML sanitization uses regex** — DOMPurify not available server-side
- ⚠️ **JSONB amount fields use JavaScript `number` type** — potential precision loss

---

## Section 11 — Performance & Scale

**Score: 5/10 — PARTIAL**

### Index Analysis

| Table | Indexed | Status |
|---|---|---|
| grievances | 11 indexes (org, status, type, priority, step, grievant, rep, employer, cba, deadline, number) | ✅ GOOD |
| arbitrations | 3 indexes (org, status, date) | ✅ GOOD |
| settlements | 3 indexes (org, status, grievance) | ✅ GOOD |
| **claims** | **0 indexes** (no org index, no status index) | 🔴 **CRITICAL** |
| **documents** | **0 indexes** (no org index, no folder index) | 🔴 **CRITICAL** |

### Findings

- ✅ **Cursor-based pagination** on Django REST endpoints (page_size=50)
- ✅ **Drizzle offset/limit pagination** on TypeScript routes
- ⚠️ **N+1 query in admin-actions.ts**: Org list loads, then N queries for user count + N queries for storage per org (isolated to admin dashboard, not hotpath)
- 🔴 **No bulk insert pattern** for claims — single-row inserts only
- 🔴 **Claims table has NO indexes** — `organizationId` queries will full-table-scan
- 🔴 **Documents table has NO indexes** — `organizationId` queries will full-table-scan

### Risk

High-volume import (1000+ CUPE cases) = 1000+ individual DB round-trips with no batch optimization and full table scans on every org-filtered query.

---

## Section 12 — Audit & Traceability

**Score: 7/10 — PARTIAL**

### What Gets Audited

| Operation | Audit Method | Evidence Pack |
|---|---|---|
| Case intake submission | `auditDataMutation()` + `auditLog(INTAKE_SUBMITTED)` | ✅ |
| Grievance creation | `auditDataMutation()` + `auditLog(CASE_CREATED)` | ✅ |
| Status transitions | `auditDataMutation()` + contextual auditLog | ✅ |
| Steward assignment | `auditDataMutation()` + `auditLog(CASE_ASSIGNED)` | ✅ |
| Case notes | `auditDataMutation()` with content length | ✅ |
| Authority violations | `auditLog(AUTHORITY_VIOLATION)` | — |
| Case export | `auditCaseExport()` | — |
| Document uploads | `auditDataMutation()` | — |
| Priority override | `auditLog(CASE_PRIORITY_OVERRIDDEN)` | — |

### Audit Log Schema

Comprehensive 20+ field schema: `auditId`, `organizationId`, `userId`, `action`, `resourceType`, `resourceId`, `oldValues`/`newValues` (JSONB), `ipAddress`, `userAgent`, `sessionId`, `correlationId`, `severity`, `outcome`, `errorMessage`, `metadata`, `archived`, `archivedAt`, `archivedPath`, `createdAt`. CHECK constraints on action, severity, outcome.

### Immutability

- ✅ Audit logs: archive-field-only updates allowed (no mutation of content fields)
- ✅ Grievance transitions: NO UPDATE/DELETE (trigger-protected)
- ✅ Grievance approvals: NO UPDATE/DELETE (trigger-protected)
- ✅ Claim updates: NO UPDATE/DELETE (trigger-protected)
- ✅ Votes: NO UPDATE/DELETE (trigger-protected)

### Gaps

- ⚠️ **PII decryption NOT audited** — `auditPIIAccess()` exists but never called. Encrypted fields (DOB, SIN) decrypted without trace. **Regulatory risk (PIPEDA).**
- ⚠️ **Data reads NOT audited** — `auditDataAccess()` exists but NOT called in GET routes for case detail, grievance detail
- ⚠️ **Admin seed deletion unaudited** — `db.delete(grievances)` and `db.delete(organizationMembers)` in seed route with no audit
- ⚠️ **Correlation ID schema exists but never populated** — cannot trace related audit events across a single request
- ⚠️ **Session ID never set** — cannot correlate events within a user session
- ⚠️ `grievanceEvents` table NOT protected by immutability trigger (only transitions/approvals are)

---

## Section 13 — Final Readiness Report

### Critical Blockers (MUST fix before CUPE data)

| # | Issue | Section | Severity |
|---|-------|---------|----------|
| 1 | **Cross-org data leak**: `getClaimById()` has NO organizationId filter — any authenticated user can read any claim | §6 | 🔴 CRITICAL |
| 2 | **`claims.organizationId` is NULLABLE** — claims can exist without org ownership, breaking multi-tenancy | §6 | 🔴 CRITICAL |
| 3 | **No document-case FK or join table** — documents cannot be linked to cases at the database level | §5 | 🔴 CRITICAL |
| 4 | **No bulk import/migration API** — no way to ingest thousands of existing CUPE cases | §1 | 🔴 CRITICAL |
| 5 | **No idempotency on case/grievance creation** — retry = duplicates with no detection or prevention | §8 | 🔴 CRITICAL |
| 6 | **Claims table has ZERO indexes** — full table scan on every org-filtered query | §11 | 🔴 CRITICAL |

### High-Risk Issues (Should fix before CUPE data)

| # | Issue | Section | Severity |
|---|-------|---------|----------|
| 7 | **`defensibilityPacks.caseId` has no FK constraint** — orphan evidence packs possible | §6 | 🟠 HIGH |
| 8 | **No CASCADE on grievanceTransitions/Assignments** — claim deletion orphans history | §6 | 🟠 HIGH |
| 9 | **Documents table has ZERO indexes** — full table scan on org queries | §11 | 🟠 HIGH |
| 10 | **Dual FSM coexistence** — legacy `grievance-state-machine.ts` + unified `case-lifecycle.ts` risk state drift | §3 | 🟠 HIGH |
| 11 | **No transaction wrapping for claim creation** — failed insert leaves inconsistent state | §9 | 🟠 HIGH |
| 12 | **No retry/recovery for failed ingestion** — single-attempt with no dead letter queue | §9 | 🟠 HIGH |
| 13 | **PII decryption not audited** — PIPEDA compliance gap | §12 | 🟠 HIGH |

### Data Integrity Risks

- Claims can exist without an organization (nullable `organizationId`)
- Documents stored with no FK to the cases they belong to — organizational ownership is the only link
- Evidence packs reference claims by ID with no FK enforcement
- Deleting a claim leaves orphan transitions, approvals, and assignments
- JSONB `attachments` field stores document references as opaque JSON (no referential integrity)

### FSM Risks

- Two FSMs coexist: deprecated grievance-state-machine + unified case-lifecycle
- State bridge maps between them, but each maintains independent state — risk of divergence
- FSM enforcement is API-layer only — direct DB writes bypass all transition rules
- No DB constraint prevents writing an invalid status outside the enum set (pgEnum covers valid strings but not valid transitions)

### Document Handling Risks

- Documents are org-scoped only — no case link at the database level
- No versioning — re-upload duplicates, no history
- No content hashing — identical files uploaded multiple times
- 50 MB per-file limit exists but no total storage quota per org
- Bulk document operations have partial success pattern (some succeed, some fail, no rollback)

### Recommended Safeguards Before Pilot

1. **Add `WHERE organization_id = ?` to `getClaimById()`** — fix the IDOR vulnerability
2. **ALTER TABLE claims ALTER COLUMN organization_id SET NOT NULL** — enforce org ownership
3. **Create `case_documents` join table** with FKs to both `claims` and `documents`
4. **Add indexes**: `CREATE INDEX idx_claims_org ON claims(organization_id)`, `CREATE INDEX idx_documents_org ON documents(organization_id)`
5. **Implement idempotency**: Add `external_source_id` column + `ON CONFLICT` upsert for migration imports
6. **Build bulk import endpoint**: Batch insert with per-record error tracking, dead letter queue, and progress reporting
7. **Add CASCADE or SET NULL** on grievanceTransitions and grievanceAssignments FKs
8. **Remove or fully deprecate** the legacy grievance-state-machine (single FSM only)
9. **Wrap claim creation in `db.transaction()`** — atomic insert of claim + audit + evidence
10. **Call `auditPIIAccess()`** when decrypting sensitive member data (DOB, SIN)

### Migration Readiness Verdict

## **NOT READY**

UnionEyes has strong foundational architecture — comprehensive audit trails with database-enforced immutability, strict Zod+pgEnum validation, multi-layer RBAC, a well-designed unified FSM with guard conditions, and excellent SQL injection prevention. The CBA intelligence pipeline demonstrates the system _can_ do proper idempotent ingestion with content hashing.

However, **6 critical blockers** prevent safe ingestion of real CUPE data:

1. The cross-org data leak in `getClaimById()` is an active security vulnerability that would expose one local's grievances to another
2. Nullable `organizationId` on claims means migrated cases could become organizational orphans
3. Without a document-case FK, there is no way to guarantee documents stay linked to their cases
4. Without a bulk import API, there is no way to ingest existing CUPE cases at scale
5. Without idempotency, any import retry will create duplicate cases with no way to detect them
6. Without indexes on the claims table, performance will degrade immediately with real data volume

These are not architectural problems — they are missing-column, missing-index, missing-WHERE-clause issues that can each be fixed in a single PR. The system is **1–2 sprints from ready** once the critical blockers and high-risk items are addressed.

---

_Audit performed by GitHub Copilot — 2026-04-09_
