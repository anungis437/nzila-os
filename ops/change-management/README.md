# Change Management

**Owner:** Platform Engineering  
**Review Cadence:** Quarterly (sampling), per-release (checklist)  
**Controls Covered:** CM-01, CM-02, CM-03, CM-04, CM-05

## Purpose

Define change management procedures for Nzila OS, ensuring all production changes
are reviewed, approved, tested, and documented with full evidence trails.

## Change Types

| Type | Approval Required | Evidence Required |
|---|---|---|
| Code change (PR) | ≥ 1 reviewer approval | PR metadata, CI results |
| Database migration | PR approval + migration review | Migration journal, schema diff |
| Infrastructure change (IaC) | PR approval + plan review | Terraform/Bicep plan + apply log |
| Configuration change | PR approval | Config diff, deployment log |
| Emergency hotfix | Post-hoc approval (within 24h) | Hotfix justification + retrospective |

## Procedures

### Standard Change (PR-based)

1. Create feature branch from `main`
2. Implement change with tests
3. Open PR — CI runs automatically (lint, test, build)
4. Obtain ≥ 1 approving review
5. Complete release checklist (see template below)
6. Merge to `main` → automated deployment
7. Verify deployment health
8. Document rollback test results

### Release Checklist Template

```markdown
# Release Checklist: {version}

- [ ] All CI checks passing
- [ ] Code review approved (≥ 1 reviewer)
- [ ] Database migrations tested in staging
- [ ] Rollback procedure documented and tested
- [ ] No critical/high dependency vulnerabilities
- [ ] Documentation updated (if applicable)
- [ ] Deployer: {name}
- [ ] Deploy date: {YYYY-MM-DD}
- [ ] Sign-off: {name}
```

## Evidence to Capture

| Artifact | Format | Control | Storage Path | Retention |
|---|---|---|---|---|
| PR metadata (author, reviewers, approval, merge SHA) | JSON | CM-01 | `evidence/{entity_id}/change-mgmt/{YYYY}/{MM}/pr-evidence/{pr_number}/` | 7_YEARS |
| Database migration journal | JSON | CM-02 | `evidence/{entity_id}/change-mgmt/{YYYY}/{MM}/db-migrations/` | 7_YEARS |
| Release checklist (completed) | PDF/JSON | CM-03 | `evidence/{entity_id}/change-mgmt/{YYYY}/{MM}/release-checklist/{release_tag}/` | 3_YEARS |
| Rollback test log | JSON | CM-04 | `evidence/{entity_id}/change-mgmt/{YYYY}/{MM}/rollback-test/{release_tag}/` | 3_YEARS |
| IaC plan + apply log | JSON | CM-05 | `evidence/{entity_id}/change-mgmt/{YYYY}/{MM}/iac-changes/{change_id}/` | 7_YEARS |
| Evidence pack index | JSON | All CM | Same path as release checklist | 3_YEARS |

### Required Metadata Fields

- `entity_id`, `artifact_id` (e.g., `PR-1234`, `REL-v2.3.0`), `sha256`, `created_by`, `retention_class`

### Hashing Expectation

All artifacts uploaded via `@nzila/blob` → SHA-256 auto-computed → stored in `documents.sha256` → `audit_event` logged with `action = 'change_evidence_uploaded'`.

## Quarterly Sampling

See `Control-Test-Plan.md` → CT-03 for the quarterly change management sampling procedure.

## References

- [Required Evidence Map](../compliance/Required-Evidence-Map.md) — CM-01 through CM-05
- [Control Test Plan](../compliance/Control-Test-Plan.md) — CT-03
- [Runbook Template Schema](../runbooks/TEMPLATE_SCHEMA.md)
