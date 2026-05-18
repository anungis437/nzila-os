# Union Eyes — Trust Center Index

> **Audience:** Procurement reviewers, institutional buyers, governance auditors.
> **Generated:** 2026-05-18T18:25:53.678Z
> **Coverage score:** 76%

This index provides a buyer-readable summary of Union Eyes governance, security,
and operational evidence. All claims are grounded in repository artifacts and
generated automatically from the evidence manifest.

**Public-safe caveats:**
- Claims use language such as "is designed to," "supports," and "provides evidence of."
- No claim in this document represents a formal certification unless a certification
  document is explicitly referenced.
- This document does not contain secrets, credentials, client-specific references,
  or private meeting notes.

---

## Evidence Coverage Summary

| Metric | Value | Metric | Value | Metric | Value | Metric | Value |
|--------|-------|--------|-------|--------|-------|--------|-------|
| **Total claims** | 17 | **Present** | 10 | **Partial** | 6 | **Missing** | 1 |

**Buyer-visible claims:** 17

---

## Claim Coverage Table

| Status | Claim ID | Title | Buyer Visible |
|--------|----------|-------|---------------|
| ✅ | `route-governance` | Runtime route governance registry | ✅ |
| ✅ | `api-governance-validation` | API governance CI validation | ✅ |
| 🟡 | `middleware-activation` | Middleware layer activation and rate limiting | ✅ |
| 🟡 | `org-isolation` | Organisation isolation hardening | ✅ |
| ❌ | `migration-lineage` | Database migration lineage and manifest | ✅ |
| 🟡 | `rbac-role-auth` | Role-based access control and dashboard auth parity | ✅ |
| ✅ | `policy-orchestration` | Governance policy orchestration and federation inheritance | ✅ |
| ✅ | `governance-observability` | Governance observability and evidence correlation | ✅ |
| 🟡 | `governance-simulation` | Governance digital twin and operational simulation | ✅ |
| 🟡 | `federation-sovereignty` | Sovereign federation execution fabric | ✅ |
| ✅ | `ai-governance` | AI governance and human oversight controls | ✅ |
| 🟡 | `public-experience-governance` | Public-experience governance primitives | ✅ |
| ✅ | `narrative-governance` | Narrative governance and terminology alignment | ✅ |
| ✅ | `security-auth-audit` | Security and authentication audit evidence | ✅ |
| ✅ | `business-continuity` | Business continuity and rollback evidence | ✅ |
| ✅ | `pilot-evidence` | Pilot readiness and procurement documentation | ✅ |
| ✅ | `docs-hygiene` | Documentation hygiene and evidence organisation | ✅ |

---

## Trust Center Documents

The following documents provide buyer-readable summaries for each trust domain:

| Document | Domain |
|----------|--------|
| [SECURITY_AND_PRIVACY_OVERVIEW.md](./SECURITY_AND_PRIVACY_OVERVIEW.md) | Security controls and data privacy posture |
| [GOVERNANCE_AND_AUDITABILITY_OVERVIEW.md](./GOVERNANCE_AND_AUDITABILITY_OVERVIEW.md) | Runtime governance and audit trail evidence |
| [DATA_RESIDENCY_AND_INFRASTRUCTURE_OVERVIEW.md](./DATA_RESIDENCY_AND_INFRASTRUCTURE_OVERVIEW.md) | Data residency and infrastructure architecture |
| [AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md](./AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md) | AI accountability and human review controls |
| [FEDERATION_AND_SOVEREIGNTY_OVERVIEW.md](./FEDERATION_AND_SOVEREIGNTY_OVERVIEW.md) | Federation governance and institutional autonomy |
| [BUSINESS_CONTINUITY_AND_RECOVERY_OVERVIEW.md](./BUSINESS_CONTINUITY_AND_RECOVERY_OVERVIEW.md) | Continuity, rollback, and recovery posture |
| [PROCUREMENT_EVIDENCE_MAP.md](./PROCUREMENT_EVIDENCE_MAP.md) | Claim-to-artifact evidence mapping for procurement |
| [PUBLIC_SAFE_ARCHITECTURE_SUMMARY.md](./PUBLIC_SAFE_ARCHITECTURE_SUMMARY.md) | Architecture overview safe for external distribution |

---

## Evidence Artifact Status

| Status | Claim | Artifact Path | Description |
|--------|-------|---------------|-------------|
| ✅ | `route-governance` | `apps/union-eyes/reports/route-registry.json` | Generated registry mapping all routes to their governance policy |
| ✅ | `route-governance` | `apps/union-eyes/scripts/generate-route-registry.ts` | Script that produces the route-registry.json report |
| ✅ | `api-governance-validation` | `apps/union-eyes/scripts/validate-api-governance.ts` | CI gate that validates API route governance conformance |
| ✅ | `api-governance-validation` | `apps/union-eyes/scripts/validate-route-policies.ts` | Route policy validation companion script |
| ✅ | `middleware-activation` | `apps/union-eyes/middleware.ts` | Runtime middleware entry point with rate limiting and auth guards |
| ❌ | `middleware-activation` | `apps/union-eyes/lib/api/rate-limit.ts` | Layered rate limiting logic |
| ❌ | `org-isolation` | `apps/union-eyes/lib/api/org-scope.ts` | Organisation scope guard implementation |
| ✅ | `org-isolation` | `apps/union-eyes/docs/governance/ORG_SCOPE_AUDIT.md` | Manual org-scope audit findings and remediation evidence |
| ❌ | `migration-lineage` | `apps/union-eyes/MANIFEST.md` | SHA-256 migration manifest |
| ❌ | `migration-lineage` | `apps/union-eyes/migrations` | Migration SQL files directory |
| ❌ | `rbac-role-auth` | `apps/union-eyes/lib/auth/with-role-auth.ts` | withRoleAuth and withMinRole server-side auth enforcement wrappers |
| ✅ | `rbac-role-auth` | `apps/union-eyes/lib/dashboard/role-experience.ts` | Role-to-experience-lane mapping for dashboard personalisation |
| ✅ | `policy-orchestration` | `apps/union-eyes/lib/governance-policy/contracts.ts` | Governance contract definitions and evaluation engine |
| ✅ | `policy-orchestration` | `apps/union-eyes/lib/governance-policy/inheritance.ts` | Federation policy inheritance resolution |
| ✅ | `policy-orchestration` | `apps/union-eyes/lib/governance-policy/ai-governance.ts` | AI operation governance classification |
| ✅ | `governance-observability` | `apps/union-eyes/lib/governance-observability/telemetry.ts` | Governance telemetry classification and event recording |
| ✅ | `governance-observability` | `apps/union-eyes/lib/governance-observability/correlation.ts` | Correlation ID assignment and cross-event evidence linking |
| ✅ | `governance-observability` | `apps/union-eyes/lib/governance-observability/ledger.ts` | Observability event ledger with retention governance |
| ✅ | `governance-simulation` | `apps/union-eyes/lib/governance-simulation/simulation.ts` | Governance simulation engine |
| ✅ | `governance-simulation` | `apps/union-eyes/lib/governance-simulation/ledger.ts` | Simulation ledger |
| ❌ | `governance-simulation` | `apps/union-eyes/reports/governance-simulation-summary.json` | Generated governance simulation summary report |
| ✅ | `federation-sovereignty` | `apps/union-eyes/lib/federation-sovereignty/types.ts` | Sovereignty type vocabulary |
| ✅ | `federation-sovereignty` | `apps/union-eyes/lib/federation-sovereignty/delegation.ts` | Delegated authority chain evaluation |
| ✅ | `federation-sovereignty` | `apps/union-eyes/lib/federation-sovereignty/simulation.ts` | Cross-federation simulation engine |
| ❌ | `federation-sovereignty` | `apps/union-eyes/reports/federation-sovereignty-summary.json` | Generated federation sovereignty summary report |
| ✅ | `ai-governance` | `apps/union-eyes/lib/governance-policy/ai-governance.ts` | AI operation risk classification and governance gate |
| ✅ | `ai-governance` | `apps/union-eyes/lib/governance-simulation/ai-simulation.ts` | AI governance simulation scenarios |
| ✅ | `ai-governance` | `apps/union-eyes/lib/federation-sovereignty/autonomy.ts` | AI autonomy boundary resolution per federation tier |
| ✅ | `ai-governance` | `apps/union-eyes/docs/trust-center/AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md` | Buyer-readable AI governance overview |
| ✅ | `public-experience-governance` | `apps/union-eyes/lib/public-experience/types.ts` | Public-experience governance type vocabulary including federation sovereignty metadata |
| ❌ | `public-experience-governance` | `apps/union-eyes/lib/public-experience/visibility.ts` | Visibility resolution for public-experience surfaces |
| ✅ | `narrative-governance` | `apps/union-eyes/tooling/marketing/narrative-audit.ts` | Narrative audit script |
| ✅ | `narrative-governance` | `apps/union-eyes/docs/governance/TERMINOLOGY_ALIGNMENT.md` | Terminology alignment contract |
| ✅ | `security-auth-audit` | `apps/union-eyes/docs/security/AUTH_REALITY_AUDIT.md` | Auth layer audit findings |
| ✅ | `security-auth-audit` | `apps/union-eyes/docs/security/SECRET_MANAGEMENT_VALIDATION.md` | Secrets posture evidence |
| ✅ | `security-auth-audit` | `apps/union-eyes/docs/security/INCIDENT_DRILL_REPORT.md` | Incident response rehearsal results |
| ✅ | `security-auth-audit` | `apps/union-eyes/docs/security/BACKUP_RESTORE_VALIDATION.md` | Disaster recovery validation evidence |
| ✅ | `business-continuity` | `apps/union-eyes/docs/operations/ROLLBACK_VALIDATION.md` | Rollback procedure and validation evidence |
| ✅ | `business-continuity` | `apps/union-eyes/docs/operations/PRODUCTION_CUTOVER_CHECKLIST.md` | Production go-live checklist |
| ✅ | `business-continuity` | `apps/union-eyes/docs/operations/DEPLOYMENT_REHEARSAL.md` | Deployment rehearsal results |
| ✅ | `pilot-evidence` | `apps/union-eyes/docs/procurement/PILOT_SCOPE.md` | Pilot program scope and constraints |
| ✅ | `pilot-evidence` | `apps/union-eyes/docs/procurement/PILOT_VALIDATION.md` | Pilot validation results |
| ✅ | `pilot-evidence` | `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md` | Production readiness memo for buyer evidence |
| ✅ | `pilot-evidence` | `apps/union-eyes/docs/procurement/FINAL_READINESS_STATUS.md` | Gate sign-off record |
| ✅ | `docs-hygiene` | `apps/union-eyes/docs/INDEX.md` | Central documentation navigation index |
| ✅ | `docs-hygiene` | `apps/union-eyes/docs/architecture/ARCHITECTURE_SHAPE.md` | System architecture overview |
| ✅ | `docs-hygiene` | `apps/union-eyes/docs/architecture/GOVERNANCE_RUNTIME_MODEL.md` | Governance runtime model documentation |

---

## Missing or Partial Evidence

- **`migration-lineage`** — Without migration lineage, schema integrity cannot be verified by auditors.


---

## Related Resources

| Resource | Purpose |
|----------|---------|
| `reports/trust-center-evidence-manifest.json` | Machine-readable evidence manifest |
| `reports/route-registry.json` | Generated API/route governance registry |
| `reports/governance-simulation-summary.json` | Governance simulation summary |
| `reports/federation-sovereignty-summary.json` | Federation sovereignty summary |
| `docs/INDEX.md` | Full documentation index |
| `docs/procurement/` | Procurement and pilot readiness documents |
| `docs/security/` | Security audit and validation evidence |
| `docs/operations/` | Operations and continuity evidence |

---

*Generated by `scripts/generate-trust-center-summary.ts`. Run `pnpm trust:center` to refresh.*
