# Required Evidence Map

**Status:** Active  
**Version:** 1.0.0  
**Last Updated:** 2026-02-18  
**Owner:** Platform Engineering / CISO  
**Review Cadence:** Quarterly (or after major incident / material change)  
**Classification:** Internal — Auditor-Shareable

---

## 1. Purpose

This document maps every operational control in Nzila OS to the **exact evidence** an
external auditor needs to validate that the control is designed and operating effectively.

For each control the map specifies:

| Column | What it tells the auditor |
|---|---|
| Control Statement | Plain-language description of what is controlled |
| Owner / Frequency | Who is responsible, how often |
| Evidence Required | Exact artifacts (files, exports, logs) |
| Evidence Generator | Runbook / template / automation that produces the evidence |
| Storage Path | Azure Blob path convention where the artifact lives |
| Metadata Fields | Fields stored in `documents` / `audit_events` tables |
| Verification Steps | How an auditor independently validates integrity + completeness |

## 2. Scope

| Dimension | Coverage |
|---|---|
| Applications | `apps/web` (public), `apps/console` (internal) |
| Product modules | MinuteBookOS, EquityOS, YearEndOS |
| Infrastructure | Azure SWA / Container Apps, Azure Blob Storage |
| Database | PostgreSQL (Drizzle ORM) — `@nzila/db` |
| Auth | Clerk (RBAC + entity-scoped access via `entity_members`) |
| Blob storage | `@nzila/blob` — containers: `minutebook`, `evidence`, `exports` |

## 3. Definitions

| Term | Definition |
|---|---|
| **Control** | A policy or procedure that mitigates an identified risk |
| **Evidence artifact** | A file (PDF, JSON, CSV, log) that proves a control operated |
| **Evidence pack** | A bundle of artifacts for one event (incident, DR test, close cycle) — see `Evidence-Pack-Index.schema.json` |
| **Hash chain** | The `hash` / `previous_hash` columns in `audit_events` and `share_ledger_entries` tables that form an append-only ledger |
| **Retention class** | `PERMANENT`, `7_YEARS`, `3_YEARS`, `1_YEAR` — determines blob lifecycle policy |
| **Entity** | A legal entity managed in Nzila OS (multi-tenant) |

## 4. Roles & Responsibilities (RACI)

| Activity | Platform Eng | CISO / Security | Finance | Legal | Auditor |
|---|---|---|---|---|---|
| Define controls | C | A/R | C | C | I |
| Produce evidence | R | R | R | R | — |
| Store & hash evidence | A/R | I | I | I | — |
| Periodic control tests | R | A | R | I | I |
| Evidence review | I | R | I | I | A/R |
| Remediation | R | A | R | R | I |

> A = Accountable, R = Responsible, C = Consulted, I = Informed

---

## 5. Evidence Metadata Fields

Every evidence artifact stored in Azure Blob **must** have the following metadata recorded in the `documents` table and/or the accompanying `audit_events` entry:

| Field | Type | Description |
|---|---|---|
| `entity_id` | uuid | Legal entity this evidence belongs to |
| `control_family` | enum | One of the families below (access, change-mgmt, ir, dr-bcp, integrity, sdlc, retention) |
| `artifact_id` | string | Unique identifier (e.g., `IR-2026-001`, `DR-Q1-2026`) |
| `run_id` | uuid | Execution / workflow run that generated the artifact |
| `doc_id` | uuid | FK → `documents.id` in the database |
| `blob_container` | string | `evidence` / `minutebook` / `exports` |
| `blob_path` | string | Full path within container (see Evidence-Storage-Convention.md) |
| `sha256` | string(64) | Hex-encoded SHA-256 of file contents at upload time |
| `content_type` | string | MIME type (`application/pdf`, `application/json`, etc.) |
| `size_bytes` | integer | File size |
| `created_by` | string | `clerk_user_id` of the person/automation that uploaded |
| `created_at` | datetime | UTC timestamp of upload |
| `retention_class` | enum | `PERMANENT` / `7_YEARS` / `3_YEARS` / `1_YEAR` |
| `classification` | enum | `INTERNAL` / `CONFIDENTIAL` / `RESTRICTED` |

---

## 6. Control Families & Evidence Matrix

### 6.1 Access Control (AC)

| ID | Control Statement | Owner | Frequency | Evidence Required | Evidence Generator | Storage Path | Retention | Verification |
|---|---|---|---|---|---|---|---|---|
| AC-01 | All console access requires Clerk authentication with MFA enabled | Platform Eng | Continuous | Clerk org settings export showing MFA enforcement | `ops/runbooks/security/README.md` → Access Review runbook | `evidence/{entity_id}/access/YYYY/MM/clerk-mfa-config/` | 3_YEARS | Auditor logs into Clerk dashboard or reviews exported config; confirms MFA is `required` |
| AC-02 | Entity-scoped RBAC: users see only entities they are members of | Platform Eng | Continuous | `entity_members` table export filtered by entity; middleware audit logs | Access Review runbook | `evidence/{entity_id}/access/YYYY/MM/rbac-membership-export/` | 3_YEARS | Cross-reference `entity_members` rows with Clerk user list; confirm no orphaned access |
| AC-03 | Role assignments follow least-privilege (admin, editor, viewer) | CISO | Quarterly | Quarterly access review report (JSON/PDF) showing role distribution per entity | Access Review runbook → quarterly-access-review template | `evidence/{entity_id}/access/YYYY/QN/access-review-report/` | 3_YEARS | Sample 10% of users; confirm role matches job function; check for excessive admin grants |
| AC-04 | Service accounts / API keys rotated on schedule | Platform Eng | 90 days | Key rotation log showing old key revoked, new key activated, timestamp | Key Rotation runbook (`ops/runbooks/security/README.md`) | `evidence/{entity_id}/access/YYYY/MM/key-rotation-log/` | 3_YEARS | Confirm rotation timestamp < 90 days from previous; verify old key returns 401 |
| AC-05 | Off-boarding: access revoked within 24 hours of termination | CISO | Per event | Clerk user deactivation event + `entity_members` deletion audit event | Off-boarding runbook | `evidence/{entity_id}/access/YYYY/MM/offboarding/{user_id}/` | 7_YEARS | Compare HR termination date with Clerk deactivation timestamp; delta ≤ 24h |

### 6.2 Change Management (CM)

| ID | Control Statement | Owner | Frequency | Evidence Required | Evidence Generator | Storage Path | Retention | Verification |
|---|---|---|---|---|---|---|---|---|
| CM-01 | All production changes require PR with at least one approval | Platform Eng | Per change | GitHub PR metadata (author, reviewers, approval, merge commit SHA) | CI/CD pipeline + `ops/change-management/README.md` | `evidence/{entity_id}/change-mgmt/YYYY/MM/pr-evidence/{pr_number}/` | 7_YEARS | Query GitHub API for merged PRs; confirm each has ≥ 1 approved review |
| CM-02 | Database migrations tracked and versioned (Drizzle) | Platform Eng | Per change | Migration file list + drizzle migration journal | Deployment runbook | `evidence/{entity_id}/change-mgmt/YYYY/MM/db-migrations/` | 7_YEARS | Compare `drizzle/journal.json` to production schema; confirm no untracked changes |
| CM-03 | Release checklist completed pre-deploy | Platform Eng | Per release | Completed release checklist (JSON/PDF) with sign-off | Release Checklist template (`ops/change-management/README.md`) | `evidence/{entity_id}/change-mgmt/YYYY/MM/release-checklist/{release_tag}/` | 3_YEARS | Review checklist for completeness; confirm all items checked; verify signer identity |
| CM-04 | Rollback tested and documented | Platform Eng | Per release | Rollback test log (stdout capture, before/after health checks) | Rollback Test runbook | `evidence/{entity_id}/change-mgmt/YYYY/MM/rollback-test/{release_tag}/` | 3_YEARS | Confirm rollback test timestamp precedes production deploy; verify health check pass |
| CM-05 | Infrastructure changes go through IaC (Terraform/Bicep) | Platform Eng | Per change | IaC plan output + apply log | IaC Change runbook | `evidence/{entity_id}/change-mgmt/YYYY/MM/iac-changes/{change_id}/` | 7_YEARS | Compare IaC state file to live infra; confirm no drift |

### 6.3 Incident Response (IR)

| ID | Control Statement | Owner | Frequency | Evidence Required | Evidence Generator | Storage Path | Retention | Verification |
|---|---|---|---|---|---|---|---|---|
| IR-01 | All P1/P2 incidents have a documented postmortem within 5 business days | CISO | Per incident | Postmortem document (markdown → PDF), timeline, root cause, remediation items | `ops/incident-response/templates/README.md` → Postmortem template | `evidence/{entity_id}/incident-response/YYYY/MM/postmortem/{incident_id}/` | 7_YEARS | Confirm postmortem exists within 5 days of incident close; verify root cause and action items are present |
| IR-02 | Incident timeline preserved with immutable audit trail | Platform Eng | Per incident | `audit_events` export for incident window (JSON); hash chain verification report | IR runbook | `evidence/{entity_id}/incident-response/YYYY/MM/audit-trail/{incident_id}/` | 7_YEARS | Re-compute hash chain for incident window; confirm no gaps or mutations |
| IR-03 | Affected systems identified and containment actions logged | CISO | Per incident | Containment log (systems isolated, access revoked, IPs blocked) | IR runbook step 2 (Contain) | `evidence/{entity_id}/incident-response/YYYY/MM/containment-log/{incident_id}/` | 7_YEARS | Cross-reference containment actions with affected system inventory; confirm all covered |
| IR-04 | Remediation items tracked to closure | CISO | Per incident | Remediation tracker (issues, owners, deadlines, completion dates) | PIR follow-up process | `evidence/{entity_id}/incident-response/YYYY/MM/remediation/{incident_id}/` | 7_YEARS | Verify all remediation items have closure evidence; confirm no items open past deadline |

### 6.4 Disaster Recovery & Business Continuity (DR)

| ID | Control Statement | Owner | Frequency | Evidence Required | Evidence Generator | Storage Path | Retention | Verification |
|---|---|---|---|---|---|---|---|---|
| DR-01 | Database backups run daily; tested quarterly | Platform Eng | Daily / Quarterly | Backup job logs (daily); restore test report (quarterly) with restored-data checksum | `ops/disaster-recovery/README.md` → DR Restore Test runbook | `evidence/{entity_id}/dr-bcp/YYYY/QN/restore-test-report/` | 7_YEARS | Review restore test report; confirm restored checksum matches source; verify test date ≤ 90 days ago |
| DR-02 | RTO ≤ 4 hours; RPO ≤ 1 hour documented and tested | Platform Eng | Quarterly | DR test report showing actual recovery time and data loss window | DR Test runbook | `evidence/{entity_id}/dr-bcp/YYYY/QN/dr-test-report/` | 3_YEARS | Compare actual RTO/RPO from test with policy targets; flag any exceedance |
| DR-03 | Business continuity plan reviewed and updated annually | CISO | Annual | BCP document (versioned PDF) with review sign-off | `ops/business-continuity/README.md` → BCP Review runbook | `evidence/{entity_id}/dr-bcp/YYYY/bcp-review/` | PERMANENT | Confirm BCP document version date ≤ 12 months; verify reviewer signatures |
| DR-04 | Blob storage geo-redundancy configured (RA-GRS) | Platform Eng | Annual | Azure Storage account config export showing replication type | Infrastructure review runbook | `evidence/{entity_id}/dr-bcp/YYYY/blob-redundancy-config/` | 3_YEARS | Query Azure API or review portal screenshot showing RA-GRS enabled |

### 6.5 Integrity Controls (IC)

| ID | Control Statement | Owner | Frequency | Evidence Required | Evidence Generator | Storage Path | Retention | Verification |
|---|---|---|---|---|---|---|---|---|
| IC-01 | All documents hashed (SHA-256) at upload via `@nzila/blob` | Platform Eng | Continuous | `documents` table export showing `sha256` populated for all rows | Integrity audit script | `evidence/{entity_id}/integrity/YYYY/MM/document-hash-audit/` | 3_YEARS | Re-download sample of blobs; recompute SHA-256; compare with `documents.sha256` |
| IC-02 | Share ledger is append-only with hash chain (`share_ledger_entries`) | Platform Eng | Continuous | Hash chain verification report (JSON): sequential hash validation, gap detection | `tooling/scripts/generate-evidence-index.ts` or dedicated chain-verify script | `evidence/{entity_id}/integrity/YYYY/MM/share-ledger-chain-verify/` | PERMANENT | Re-compute `hash(entry_data + previous_hash)` for each entry; confirm chain is unbroken |
| IC-03 | Audit events are append-only with hash chain (`audit_events`) | Platform Eng | Continuous | Hash chain verification report (JSON) | Audit chain verify script | `evidence/{entity_id}/integrity/YYYY/MM/audit-event-chain-verify/` | PERMANENT | Same as IC-02 but against `audit_events` table |
| IC-04 | No direct database writes outside application layer | Platform Eng | Quarterly | Database access audit log (pg_audit or equivalent); list of DB users/roles | Access audit runbook | `evidence/{entity_id}/integrity/YYYY/QN/db-access-audit/` | 3_YEARS | Review DB user list; confirm only app service account has write access; check for ad-hoc queries |
| IC-05 | Corrections use counter-entries, never mutations | Platform Eng | Continuous | Sample of correction entries showing original + counter-entry pairs | Manual audit / finance close process | `evidence/{entity_id}/integrity/YYYY/MM/counter-entry-samples/` | PERMANENT | Query `share_ledger_entries` for correction types; confirm original entry is never modified |

### 6.6 Software Development Lifecycle (SDLC)

| ID | Control Statement | Owner | Frequency | Evidence Required | Evidence Generator | Storage Path | Retention | Verification |
|---|---|---|---|---|---|---|---|---|
| SDLC-01 | Code reviewed before merge (branch protection) | Platform Eng | Per PR | GitHub branch protection settings export; PR merge records | CI pipeline | `evidence/{entity_id}/sdlc/YYYY/MM/branch-protection-config/` | 3_YEARS | Query GitHub API for branch protection rules on `main`; confirm review required |
| SDLC-02 | Automated tests pass before merge | Platform Eng | Per PR | CI test results (pass/fail, coverage %) | CI pipeline (GitHub Actions / Turbo) | `evidence/{entity_id}/sdlc/YYYY/MM/ci-test-results/{pr_number}/` | 1_YEAR | Review CI logs for merged PRs; confirm all checks passed before merge |
| SDLC-03 | Dependency vulnerabilities scanned | Platform Eng | Weekly | `pnpm audit` output / Dependabot alerts export | Security scanning runbook | `evidence/{entity_id}/sdlc/YYYY/MM/dependency-audit/` | 1_YEAR | Review audit output; confirm critical/high vulns have remediation plan or accepted risk |
| SDLC-04 | Secrets not committed to source code | Platform Eng | Continuous | Secret scanning results (GitHub secret scanning / git-secrets) | Pre-commit hooks + CI scan | `evidence/{entity_id}/sdlc/YYYY/MM/secret-scan-results/` | 1_YEAR | Run secret scanner against repo history; confirm zero findings or documented exceptions |

### 6.7 Data Retention (DR-RET)

| ID | Control Statement | Owner | Frequency | Evidence Required | Evidence Generator | Storage Path | Retention | Verification |
|---|---|---|---|---|---|---|---|---|
| DR-RET-01 | Evidence artifacts retained per retention class schedule | Platform Eng | Annual | Blob lifecycle policy export; sample of artifacts confirming retention | Retention audit runbook | `evidence/{entity_id}/retention/YYYY/retention-policy-export/` | PERMANENT | Review Azure Blob lifecycle management rules; confirm they match retention classes |
| DR-RET-02 | Expired artifacts purged per policy (soft-delete → hard-delete) | Platform Eng | Monthly | Purge log showing artifacts deleted after retention expiry | Automated lifecycle policy | `evidence/{entity_id}/retention/YYYY/MM/purge-log/` | 3_YEARS | Verify purge log entries match retention class expiry dates; confirm no premature deletions |
| DR-RET-03 | Legal hold capability exists and is documented | Legal | Per event | Legal hold procedure document; evidence of hold applied (if any) | Legal hold runbook | `evidence/{entity_id}/retention/YYYY/legal-hold-evidence/` | PERMANENT | Confirm legal hold procedure exists; if holds active, verify artifacts are excluded from purge |

---

## 7. Auditor Verification Workflow

An external auditor should follow this procedure to validate any control:

```
1. SELECT a control from Sections 6.1–6.7 (e.g., IC-02: Share ledger hash chain)
2. LOCATE the Evidence Generator runbook referenced in the control row
3. REQUEST evidence artifacts from the Storage Path for the review period
   → Platform team generates a short-lived SAS URL (≤ 60 min, read-only)
4. DOWNLOAD the artifact via SAS URL
5. VERIFY integrity:
   a. Recompute SHA-256 of the downloaded file
   b. Compare with sha256 in the `documents` table (request DB export or live query)
   c. Locate the corresponding `audit_events` entry for the upload action
   d. Verify the hash chain in audit_events is unbroken around that timestamp
6. ASSESS completeness:
   a. For periodic controls: confirm evidence exists for every required period
   b. For event-driven controls: confirm evidence exists for every incident/change
7. DOCUMENT findings in auditor's workpapers
```

## 8. Evidence Pack Format

Evidence for a single event (incident, DR test, period close) is bundled into an
**Evidence Pack** — a JSON index file referencing all artifacts.

- Schema: `ops/compliance/Evidence-Pack-Index.schema.json`
- Example: `ops/compliance/Evidence-Pack-Index.example.json`
- Generator: `tooling/scripts/generate-evidence-index.ts`

The index file itself is stored alongside the artifacts:
`evidence/{entity_id}/{control_family}/{YYYY}/{MM}/{event_type}/{event_id}/evidence-pack-index.json`

## 9. Cross-References

| Document | Location |
|---|---|
| Evidence Storage Convention | `ops/compliance/Evidence-Storage-Convention.md` |
| Evidence Pack Index Schema | `ops/compliance/Evidence-Pack-Index.schema.json` |
| Control Test Plan | `ops/compliance/Control-Test-Plan.md` |
| Runbook Template Schema | `ops/runbooks/TEMPLATE_SCHEMA.md` |
| Blob Package (`@nzila/blob`) | `packages/blob/src/index.ts` |
| DB Schema — `documents` table | `packages/db/src/schema/operations.ts` |
| DB Schema — `audit_events` table | `packages/db/src/schema/operations.ts` |
| DB Schema — `share_ledger_entries` | `packages/db/src/schema/equity.ts` |
| Evidence Index Generator | `tooling/scripts/generate-evidence-index.ts` |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-02-18 | Platform Engineering | Initial release — all 7 control families mapped |
