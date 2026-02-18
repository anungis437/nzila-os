# Control Test Plan

**Status:** Active  
**Version:** 1.0.0  
**Last Updated:** 2026-02-18  
**Owner:** Platform Engineering / CISO  
**Review Cadence:** Quarterly  
**Classification:** Internal — Auditor-Shareable

---

## 1. Purpose

Define periodic "control tests" that validate operational controls are functioning as designed.
Each test produces evidence artifacts stored in Azure Blob with full sha256 hashing and
audit trail, following the conventions in `Evidence-Storage-Convention.md`.

## 2. Scope

This plan covers all 7 control families from `Required-Evidence-Map.md`:
- Access Control (AC)
- Change Management (CM)
- Incident Response (IR)
- Disaster Recovery / Business Continuity (DR)
- Integrity Controls (IC)
- Software Development Lifecycle (SDLC)
- Data Retention (DR-RET)

---

## 3. Test Schedule

| Test ID | Test Name | Control IDs | Frequency | Window | Owner |
|---|---|---|---|---|---|
| CT-01 | DR Restore Test | DR-01, DR-02 | Quarterly | Weeks 2–3 of quarter start month | Platform Eng |
| CT-02 | Access Review | AC-02, AC-03, AC-05 | Quarterly | Week 1 of quarter start month | CISO |
| CT-03 | Change Management Sampling | CM-01, CM-03 | Quarterly | Week 4 of quarter end month | Platform Eng |
| CT-04 | Hash Chain Integrity Verification | IC-02, IC-03 | Monthly | Last business day of month | Platform Eng |
| CT-05 | Document Hash Spot Check | IC-01 | Monthly | Last business day of month | Platform Eng |
| CT-06 | Dependency Vulnerability Scan | SDLC-03 | Weekly | Every Monday | Platform Eng |
| CT-07 | Secret Scanning | SDLC-04 | Continuous + Monthly review | Monthly review on 1st | Platform Eng |
| CT-08 | Retention Policy Audit | DR-RET-01, DR-RET-02 | Annual | January | Platform Eng |
| CT-09 | BCP Review | DR-03 | Annual | January | CISO |
| CT-10 | Database Access Audit | IC-04 | Quarterly | Week 1 of quarter start month | Platform Eng |

---

## 4. Test Procedures

### CT-01: DR Restore Test

**Controls tested:** DR-01 (backup + restore), DR-02 (RTO/RPO validation)

**Procedure:**

1. **Select target**: Choose the production database for the entity under test
2. **Record start time**: Note UTC timestamp for RTO measurement
3. **Initiate restore**: Restore latest backup to a staging environment
   ```bash
   # Example: Azure Postgres restore
   az postgres flexible-server restore \
     --source-server prod-db \
     --target-server restore-test-$(date +%Y%m%d) \
     --restore-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)
   ```
4. **Verify data integrity**:
   - Compare row counts for key tables (`entities`, `share_ledger_entries`, `audit_events`, `documents`)
   - Run hash chain verification on `share_ledger_entries` and `audit_events`
   - Spot-check 5 recent records for data accuracy
5. **Record end time**: Calculate actual RTO (target ≤ 4 hours) and RPO (data loss window, target ≤ 1 hour)
6. **Generate evidence**:
   - Restore test report (JSON/PDF) with timestamps, row counts, checksums
   - Hash chain verification output
   - Screenshot or log of restored database health
7. **Store evidence**:
   ```
   evidence/{entity_id}/dr-bcp/{YYYY}/Q{N}/restore-test-report/DR-Q{N}-{YYYY}/
   ├── restore-test-report.json
   ├── chain-verify-share-ledger.json
   ├── chain-verify-audit-events.json
   └── evidence-pack-index.json
   ```
8. **Create evidence pack index**: Run `generate-evidence-index.ts`
9. **Log audit event**: `action = 'dr_restore_test_completed'`
10. **Clean up**: Delete staging restore instance

**Pass criteria:**
- RTO ≤ 4 hours
- RPO ≤ 1 hour
- Hash chains intact
- All key table row counts match (± concurrent writes during restore window)

**Failure escalation:** If test fails, open P2 incident and notify CISO within 4 hours.

---

### CT-02: Access Review

**Controls tested:** AC-02 (entity-scoped RBAC), AC-03 (least privilege), AC-05 (off-boarding)

**Procedure:**

1. **Export Clerk users**: Pull all active users from Clerk organization
2. **Export entity_members**: Query `entity_members` table for all entities under review
3. **Cross-reference**:
   - Every `entity_members.clerk_user_id` maps to an active Clerk user
   - No Clerk users have entity access they shouldn't (compare with HR active roster)
   - No orphaned `entity_members` rows (user deactivated but membership remains)
4. **Role distribution audit**:
   - Count users per role (admin, editor, viewer) per entity
   - Flag any entity where admin count > 3 or where admin:total ratio > 25%
5. **Off-boarding check**:
   - Get list of terminations from HR in the review period
   - Confirm each terminated user was deactivated in Clerk within 24 hours
   - Confirm `entity_members` rows were deleted
6. **Generate evidence**:
   - Access review report (JSON) with user counts, role distributions, exceptions
   - Clerk user export (sanitized — no passwords/tokens)
   - entity_members export per entity
   - Off-boarding compliance report (termination date vs deactivation date deltas)
7. **Store evidence**:
   ```
   evidence/{entity_id}/access/{YYYY}/Q{N}/access-review-report/ACR-Q{N}-{YYYY}/
   ├── access-review-report.json
   ├── clerk-user-export.json
   ├── entity-members-export.json
   ├── offboarding-compliance.json
   └── evidence-pack-index.json
   ```
8. **Create evidence pack index**: Run `generate-evidence-index.ts`
9. **Log audit event**: `action = 'access_review_completed'`

**Pass criteria:**
- Zero orphaned memberships
- All off-boardings within 24-hour SLA
- No excessive admin grants without documented justification
- Role assignments align with job functions

**Failure escalation:** Revoke excessive access immediately; document exception with CISO sign-off.

---

### CT-03: Change Management Sampling

**Controls tested:** CM-01 (PR approval), CM-03 (release checklist)

**Procedure:**

1. **Sample PRs**: Select 10% of merged PRs from the quarter (minimum 5, maximum 25)
2. **For each PR verify**:
   - At least one approving review before merge
   - CI checks passed (all status checks green)
   - No force-merges or admin overrides (or documented exceptions)
3. **Sample releases**: Select all production releases in the quarter
4. **For each release verify**:
   - Release checklist is complete (all items checked)
   - Checklist was signed by deployer
   - Rollback plan documented
5. **Generate evidence**:
   - PR sampling report (JSON) with PR numbers, authors, reviewers, approval status
   - Release checklist copies (PDF)
   - Exception log (any bypasses with justification)
6. **Store evidence**:
   ```
   evidence/{entity_id}/change-mgmt/{YYYY}/Q{N}/change-mgmt-sampling/CMS-Q{N}-{YYYY}/
   ├── pr-sampling-report.json
   ├── release-checklists/
   │   ├── v2.1.0-checklist.pdf
   │   └── v2.2.0-checklist.pdf
   ├── exception-log.json
   └── evidence-pack-index.json
   ```
7. **Create evidence pack index**: Run `generate-evidence-index.ts`
8. **Log audit event**: `action = 'change_mgmt_sampling_completed'`

**Pass criteria:**
- 100% of sampled PRs have at least one approval
- 100% of releases have completed checklists
- Any exceptions are documented with manager/CISO sign-off

---

### CT-04: Hash Chain Integrity Verification

**Controls tested:** IC-02 (share ledger hash chain), IC-03 (audit events hash chain)

**Procedure:**

1. **Run chain verification** for `share_ledger_entries`:
   ```sql
   -- Pseudocode: Verify each entry's hash = sha256(entry_data + previous_hash)
   SELECT id, hash, previous_hash,
     sha256(concat(entry_data::text, previous_hash)) as computed_hash
   FROM share_ledger_entries
   WHERE entity_id = '{entity_id}'
   ORDER BY created_at ASC;
   -- Flag any row where hash != computed_hash
   ```
2. **Run chain verification** for `audit_events`:
   ```sql
   SELECT id, hash, previous_hash,
     sha256(concat(event_data::text, previous_hash)) as computed_hash
   FROM audit_events
   WHERE entity_id = '{entity_id}'
   ORDER BY created_at ASC;
   ```
3. **Check for gaps**: Verify `previous_hash` chain has no breaks (every `previous_hash` matches the preceding row's `hash`)
4. **Generate evidence**:
   - Chain verification reports (JSON) for both tables with row counts, verification results, any anomalies
5. **Store evidence**:
   ```
   evidence/{entity_id}/integrity/{YYYY}/{MM}/chain-verify/CHK-{YYYY}-{MM}/
   ├── share-ledger-chain-verify.json
   ├── audit-events-chain-verify.json
   └── evidence-pack-index.json
   ```
6. **Create evidence pack index**: Run `generate-evidence-index.ts`
7. **Log audit event**: `action = 'hash_chain_verification_completed'`

**Pass criteria:**
- Zero hash mismatches across both tables
- Zero chain gaps

**Failure escalation:** P1 incident — potential data integrity compromise. Notify CISO and Legal immediately.

---

### CT-05: Document Hash Spot Check

**Controls tested:** IC-01 (document SHA-256 at upload)

**Procedure:**

1. **Sample documents**: Select 10 random documents from `documents` table for the entity
2. **For each document**:
   - Download blob from Azure using `blob_container` + `blob_path`
   - Compute SHA-256 of the downloaded file
   - Compare with `documents.sha256`
3. **Generate evidence**:
   - Hash verification report (JSON) with document IDs, expected hashes, computed hashes, match status
4. **Store evidence**:
   ```
   evidence/{entity_id}/integrity/{YYYY}/{MM}/document-hash-audit/DHA-{YYYY}-{MM}/
   ├── document-hash-audit.json
   └── evidence-pack-index.json
   ```
5. **Create evidence pack index**: Run `generate-evidence-index.ts`
6. **Log audit event**: `action = 'document_hash_spot_check_completed'`

**Pass criteria:**
- 100% hash match on all sampled documents

**Failure escalation:** P1 incident — potential document tampering. Notify CISO and Legal immediately.

---

### CT-06: Dependency Vulnerability Scan

**Controls tested:** SDLC-03 (dependency scanning)

**Procedure:**

1. Run `pnpm audit --json > audit-results.json`
2. Review critical and high severity findings
3. For each critical/high: create remediation ticket or document accepted risk
4. **Store evidence**:
   ```
   evidence/{entity_id}/sdlc/{YYYY}/{MM}/dependency-audit/DEP-{YYYY}-{MM}-{DD}/
   ├── pnpm-audit-results.json
   └── evidence-pack-index.json
   ```

---

### CT-07: Secret Scanning

**Controls tested:** SDLC-04 (no secrets in source)

**Procedure:**

1. Run secret scanner against repository (GitHub secret scanning / git-secrets / trufflehog)
2. Review any findings
3. If secrets found: rotate immediately, document incident
4. **Monthly review**: Export scanning results, store as evidence
5. **Store evidence**:
   ```
   evidence/{entity_id}/sdlc/{YYYY}/{MM}/secret-scan-results/SEC-{YYYY}-{MM}/
   ├── secret-scan-results.json
   └── evidence-pack-index.json
   ```

---

### CT-08: Retention Policy Audit

**Controls tested:** DR-RET-01 (retention schedule), DR-RET-02 (purge)

**Procedure:**

1. Export Azure Blob lifecycle management policy
2. Compare rules with retention classes defined in `Evidence-Storage-Convention.md`
3. Verify no artifacts were deleted before their retention class permits
4. Verify expired artifacts were properly purged (soft-delete → hard-delete cycle)
5. **Store evidence**:
   ```
   evidence/{entity_id}/retention/{YYYY}/retention-policy-export/RET-{YYYY}/
   ├── lifecycle-policy-export.json
   ├── retention-compliance-report.json
   └── evidence-pack-index.json
   ```

---

### CT-09: BCP Review

**Controls tested:** DR-03 (BCP reviewed annually)

**Procedure:**

1. Review current BCP document in `ops/business-continuity/`
2. Update for any infrastructure/personnel/process changes
3. Obtain sign-off from CISO and CTO
4. Version and store updated BCP
5. **Store evidence**:
   ```
   evidence/{entity_id}/dr-bcp/{YYYY}/bcp-review/BCP-{YYYY}/
   ├── bcp-document-v{version}.pdf
   ├── bcp-review-signoff.json
   └── evidence-pack-index.json
   ```

---

### CT-10: Database Access Audit

**Controls tested:** IC-04 (no direct DB writes outside app layer)

**Procedure:**

1. Export list of PostgreSQL users/roles with write access
2. Verify only the application service account has DML permissions
3. Review `pg_stat_activity` or query logs for ad-hoc connections
4. Document any exceptions (emergency access with CISO approval)
5. **Store evidence**:
   ```
   evidence/{entity_id}/integrity/{YYYY}/Q{N}/db-access-audit/DBA-Q{N}-{YYYY}/
   ├── db-users-roles.json
   ├── query-log-review.json
   ├── exception-log.json
   └── evidence-pack-index.json
   ```

---

## 5. Evidence Storage Summary

All test outcomes follow the Evidence Storage Convention:

- **Container**: `evidence`
- **Path**: `evidence/{entity_id}/{control_family}/{YYYY}/{period}/{test_type}/{test_id}/`
- **Required files per test**: Test report + `evidence-pack-index.json`
- **Metadata**: All artifacts registered in `documents` table with sha256
- **Audit trail**: Each test completion logged in `audit_events` with hash chain

## 6. Failure & Exception Handling

| Severity | Response | Timeline | Notification |
|---|---|---|---|
| Test fails — data integrity (IC) | Open P1 incident | Immediate | CISO + Legal + CTO |
| Test fails — access control (AC) | Revoke + open P2 | Within 4 hours | CISO |
| Test fails — DR/BCP | Open P2 + retest | Within 1 week | CTO |
| Test reveals gap — CM/SDLC | Document + remediate | Within 2 weeks | Platform Eng lead |
| Test skipped/delayed | Document reason + reschedule | Within 1 week | CISO |

## 7. Reporting

- **Quarterly**: Control test summary report covering all tests run that quarter
- **Annual**: Comprehensive control effectiveness report for board/audit committee
- Reports stored at: `evidence/{entity_id}/compliance-reports/{YYYY}/Q{N}/`

---

## 8. Cross-References

| Document | Location |
|---|---|
| Required Evidence Map | `ops/compliance/Required-Evidence-Map.md` |
| Evidence Storage Convention | `ops/compliance/Evidence-Storage-Convention.md` |
| Evidence Pack Index Schema | `ops/compliance/Evidence-Pack-Index.schema.json` |
| Evidence Index Generator | `tooling/scripts/generate-evidence-index.ts` |

---

## 9. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-02-18 | Platform Engineering | Initial release — 10 control tests defined |
