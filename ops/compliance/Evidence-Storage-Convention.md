# Evidence Storage Convention

**Status:** Active  
**Version:** 1.0.0  
**Last Updated:** 2026-02-18  
**Owner:** Platform Engineering  
**Review Cadence:** Quarterly (or after material infrastructure change)  
**Classification:** Internal — Auditor-Shareable

---

## 1. Purpose

Define the Azure Blob Storage structure, naming conventions, retention policies, and
access controls for all audit evidence and operational artifacts in Nzila OS.

This convention ensures:
- Predictable, machine-parseable paths for every evidence artifact
- Consistent retention lifecycle management
- Least-privilege access via short-lived SAS URLs
- Compatibility with the Required Evidence Map and Evidence Pack Index

## 2. Scope

| Dimension | Coverage |
|---|---|
| Storage service | Azure Blob Storage (StorageV2, RA-GRS) |
| SDK | `@nzila/blob` (`packages/blob/src/index.ts`) |
| Auth provider | Azure `StorageSharedKeyCredential` (server-side); SAS tokens (external sharing) |
| Environments | Production, Staging (separate storage accounts) |

---

## 3. Containers

Three top-level containers are used. Each has a distinct purpose and access pattern.

| Container | Purpose | Default Access | Retention Default |
|---|---|---|---|
| `minutebook` | Corporate governance documents (resolutions, certificates, meeting minutes, share certificates) | Private | PERMANENT |
| `evidence` | Compliance & audit evidence artifacts (IR postmortems, DR test reports, access reviews, hash chain verifications) | Private | Per `retention_class` tag |
| `exports` | User-generated exports (cap table CSV, register PDFs, reports) | Private | 1_YEAR |

### Creating Containers

Containers are created once per storage account during provisioning.
The `@nzila/blob` SDK's `container(name)` function calls `createIfNotExists()` on first use.

---

## 4. Blob Path Convention

### 4.1 Evidence Container

```
evidence/{entity_id}/{control_family}/{YYYY}/{MM}/{artifact_type}/{artifact_id}/{filename}
```

| Segment | Rules | Examples |
|---|---|---|
| `entity_id` | UUID or slug from `entities.slug` | `memora-inc`, `acme-holdings` |
| `control_family` | Kebab-case, matches Required-Evidence-Map families | `access`, `change-mgmt`, `incident-response`, `dr-bcp`, `integrity`, `sdlc`, `retention` |
| `YYYY` | 4-digit year | `2026` |
| `MM` | 2-digit month (or `QN` for quarterly, omit for annual) | `02`, `Q1` |
| `artifact_type` | Kebab-case descriptor of the artifact category | `postmortem`, `access-review-report`, `restore-test-report`, `chain-verify`, `release-checklist` |
| `artifact_id` | Unique ID for this specific artifact | `IR-2026-001`, `DR-Q1-2026`, `PR-1234` |
| `filename` | Original or generated filename with extension | `postmortem.pdf`, `chain-verify.json`, `evidence-pack-index.json` |

**Examples:**

```
evidence/memora-inc/incident-response/2026/02/postmortem/IR-2026-001/postmortem.pdf
evidence/memora-inc/incident-response/2026/02/postmortem/IR-2026-001/audit-trail.json
evidence/memora-inc/incident-response/2026/02/postmortem/IR-2026-001/evidence-pack-index.json
evidence/memora-inc/dr-bcp/2026/Q1/restore-test-report/DR-Q1-2026/restore-report.pdf
evidence/memora-inc/access/2026/Q1/access-review-report/ACR-Q1-2026/access-review.json
evidence/memora-inc/integrity/2026/02/share-ledger-chain-verify/CHK-2026-02/chain-verify.json
evidence/memora-inc/change-mgmt/2026/02/release-checklist/v2.3.0/release-checklist.pdf
```

### 4.2 MinuteBook Container

```
minutebook/{entity_id}/{document_type}/{YYYY}/{document_id}/{filename}
```

| Segment | Examples |
|---|---|
| `document_type` | `resolutions`, `meetings`, `certificates`, `registers`, `filings` |
| `document_id` | UUID or human-readable ID from `documents` table |

**Examples:**

```
minutebook/memora-inc/resolutions/2026/res-2026-001/board-resolution-share-issuance.pdf
minutebook/memora-inc/certificates/2026/cert-001/share-certificate-001.pdf
minutebook/memora-inc/meetings/2026/mtg-2026-003/minutes-agm-2026.pdf
```

### 4.3 Exports Container

```
exports/{entity_id}/{export_type}/{YYYY}/{MM}/{export_id}/{filename}
```

**Examples:**

```
exports/memora-inc/cap-table/2026/02/exp-2026-02-01/cap-table-snapshot.csv
exports/memora-inc/register/2026/02/exp-2026-02-01/shareholder-register.pdf
```

---

## 5. Naming Rules

| Rule | Convention |
|---|---|
| Case | All path segments are **lowercase** |
| Word separator | **Kebab-case** (`access-review-report`, not `accessReviewReport`) |
| Date format | `YYYY` (4-digit year), `MM` (2-digit month, zero-padded), `QN` (quarter, e.g., `Q1`) |
| File names | Descriptive, kebab-case, with extension: `postmortem.pdf`, `chain-verify.json` |
| No spaces | Spaces are **never** used in paths or filenames |
| No special chars | Only `a-z`, `0-9`, `-`, `/`, `.` in paths |
| Max path length | ≤ 1024 characters (Azure Blob limit) |

---

## 6. Retention Classes

Each artifact is tagged with a retention class that maps to Azure Blob lifecycle management policies.

| Retention Class | Duration | Hot Tier | Cool Tier | Archive Tier | Delete |
|---|---|---|---|---|---|
| `PERMANENT` | Indefinite | 0–12 months | 12+ months | Never | Never (manual only with legal approval) |
| `7_YEARS` | 7 years | 0–12 months | 12–84 months | Never | After 84 months (soft-delete 30 days → hard-delete) |
| `3_YEARS` | 3 years | 0–12 months | 12–36 months | Never | After 36 months |
| `1_YEAR` | 1 year | 0–6 months | 6–12 months | Never | After 12 months |

### Implementation

Retention is enforced via:
1. **Blob index tags**: `retention_class=7_YEARS`, `entity_id=memora-inc`, `control_family=ir`
2. **Azure Blob lifecycle management rules**: policies filter on tags and move/delete accordingly
3. **`documents` table**: `retention_class` column for queryable metadata
4. **Legal holds**: Azure Blob immutability policies applied per-blob when legal hold is active

### Legal Hold Override

When a legal hold is active:
- Blob lifecycle rules are suspended for held blobs
- The `documents` row is flagged with `legal_hold = true`
- Only Legal team can release the hold
- Release is logged as an `audit_event`

---

## 7. Classification Tags

Every blob should have these Azure Blob index tags set at upload time:

| Tag | Required | Example |
|---|---|---|
| `entity_id` | Yes | `memora-inc` |
| `control_family` | Yes (evidence container) | `incident-response` |
| `retention_class` | Yes | `7_YEARS` |
| `classification` | Yes | `INTERNAL` / `CONFIDENTIAL` / `RESTRICTED` |
| `artifact_type` | Yes | `postmortem` |
| `created_by` | Yes | `user_2abc123` (Clerk user ID) |
| `created_at` | Yes | `2026-02-18T14:30:00Z` |
| `sha256` | Yes | `a1b2c3d4...` (first 16 chars for tag; full hash in DB) |

---

## 8. SAS URL Policy for Auditor Access

### Generation

SAS URLs are generated via `@nzila/blob`'s `generateSasUrl()` function:

```typescript
import { generateSasUrl } from '@nzila/blob';

const url = await generateSasUrl(
  'evidence',
  'memora-inc/incident-response/2026/02/postmortem/IR-2026-001/postmortem.pdf',
  60 // expiry in minutes
);
```

### Policy Rules

| Parameter | Value | Rationale |
|---|---|---|
| Permissions | **Read only** (`r`) | Auditors never need write access |
| Expiry | **≤ 60 minutes** (default) | Minimizes exposure window; can be regenerated |
| IP restrictions | Optional — restrict to auditor's IP range if known | Defense in depth |
| Protocol | **HTTPS only** | Prevent sniffing |
| Scope | **Single blob** | Never issue container-level SAS for auditor access |
| Logging | Every SAS generation is logged as an `audit_event` with `action = 'sas_url_generated'` | Full traceability |

### Auditor Workflow

1. Auditor requests evidence for a specific control + period
2. Platform team identifies artifacts via `documents` table query
3. Platform team generates SAS URLs (one per artifact, 60-min expiry)
4. URLs are shared via secure channel (encrypted email, secure portal)
5. SAS generation is logged in `audit_events` with the blob path, requester, and expiry
6. If auditor needs more time, a new SAS URL is generated (old one expires naturally)

---

## 9. Upload Procedure

### Using `@nzila/blob`

```typescript
import { uploadBuffer } from '@nzila/blob';

const result = await uploadBuffer({
  container: 'evidence',
  blobPath: `${entityId}/incident-response/2026/02/postmortem/${incidentId}/postmortem.pdf`,
  buffer: fileBuffer,
  contentType: 'application/pdf',
});

// result = { blobPath, sha256, sizeBytes }
// → Store sha256 in documents table
// → Create audit_event with action='document_uploaded', sha256, blob_path
```

### Required Steps After Upload

1. **Store metadata**: Insert row in `documents` table with `blob_container`, `blob_path`, `sha256`, `content_type`, `size_bytes`, `retention_class`, `entity_id`
2. **Create audit event**: Insert row in `audit_events` with `action = 'document_uploaded'`, hash chain continuation
3. **Set blob tags**: Apply index tags (see Section 7) via Azure SDK or at upload time
4. **Return confirmation**: Include `sha256` in API response for client-side verification

---

## 10. Cross-References

| Document | Location |
|---|---|
| Required Evidence Map | `ops/compliance/Required-Evidence-Map.md` |
| Evidence Pack Index Schema | `ops/compliance/Evidence-Pack-Index.schema.json` |
| Control Test Plan | `ops/compliance/Control-Test-Plan.md` |
| Blob Package Source | `packages/blob/src/index.ts` |
| DB Schema — `documents` table | `packages/db/src/schema/operations.ts` |

---

## 11. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-02-18 | Platform Engineering | Initial release — containers, paths, retention, SAS policy |
