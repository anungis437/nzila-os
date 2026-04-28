# Application Security Policy — Nzila Ventures

**Document ID:** ASP-2026-001
**Version:** 1.0
**Classification:** INTERNAL
**Created:** 2026-04-28
**Owner:** Security Lead / CISO
**Approver:** CTO
**Status:** ACTIVE
**Next Review:** 2027-04-28 (Annual)
**Related:** `SECURITY.md`, [`AUDIT_READINESS.md`](AUDIT_READINESS.md), [`THREAT_MODEL.md`](THREAT_MODEL.md)

---

## 1. Purpose

Establish the minimum requirements for the secure design, development, deployment,
and maintenance of all software produced by or operated for Nzila Ventures. This
policy operationalizes the Info-Tech Application Security Policy template (v4)
against the Nzila OS monorepo and is mapped to NIST CSF 2.0, NIST SP 800-53,
NIST SP 800-171, CMMC L2, SOC 2 (TSC CC7/CC8), ISO/IEC 27002:2022, CIS Controls
v8, PCI DSS v4.0, and HIPAA Security Rule (where applicable).

## 2. Scope

Applies to:

- All applications under `apps/*` and services under `services/*`
- All shared packages under `packages/*` and `platform/*`
- All infrastructure-as-code under `infrastructure/*` and `ops/*`
- All contributors, contractors, and outsourced developers committing to the repository

## 3. Definitions

- **Production**: Any deployed Container App in the `nzila-canada-{staging|prod}-rg` resource groups.
- **Audit trail**: Append-only, time-ordered record of security-relevant events with actor, action, target, and outcome.
- **Approved app**: An application present in `governance/portfolio/` and `governance/repo/` registries.

## 4. Governing Frameworks & Mappings

| # | Control Statement | Frameworks | Nzila Implementation |
|---|-------------------|------------|----------------------|
| 1 | Security requirements identified before development (incl. outsourced) | NIST CSF 2.0 GV.SC, NIST 800-53 SA-3, ISO 27002 8.25, SOC2 CC8.1 | `governance/profiles/`, `tooling/contract-tests/`, PRD gate via `scripts/validate-readmes.ts` |
| 2 | Developer secure-coding training | NIST 800-53 AT-3, ISO 27002 6.3, CMMC AT.L2-3.2.2 | **GAP** — see §7 |
| 3 | Dev/test logically separated from production | NIST 800-53 SC-7, ISO 27002 8.31, PCI DSS 6.5.4 | Container Apps environments per env (`nzila-canada-staging-env`); separate ACR repos; no shared DB |
| 4 | Test data anonymized / synthetic | NIST 800-53 SC-28, ISO 27002 8.33, GDPR Art.5 | `packages/staging-seed-*` produces synthetic data; production data never copied to staging — see §7 |
| 5 | Vulnerability remediation in source libraries / runtimes | NIST CSF 2.0 ID.RA, NIST 800-53 RA-5/SI-2, ISO 27002 8.8, PCI DSS 6.3 | [`tooling/security/supply-chain-policy.ts`](../../tooling/security/supply-chain-policy.ts), `pnpm audit`, Snyk, Trivy on Dockerfiles, `pnpm.overrides` for transitive patches, `ACTIVE_WAIVERS` registry |
| 6 | Code analysis + security testing pre-deployment | NIST 800-53 SA-11, ISO 27002 8.29, CIS 16.11 | CI workflow: `lint` → `typecheck` → `test` → `contract-tests` → `governance` → Trivy `--severity CRITICAL`; lefthook pre-commit hooks |
| 7 | Hardening standards for DBs / middleware | NIST 800-53 CM-6, ISO 27002 8.9, CIS 4 | **PARTIAL** — see §7 |
| 8 | Removal of unapproved applications | NIST 800-53 CM-7, ISO 27002 8.19, CIS 2 | `governance/portfolio/`, [`scripts/check-orphans.ts`](../../scripts/check-orphans.ts), `scripts/governance-check.ts` |
| 9 | Audit trails for security events | NIST 800-53 AU-2/AU-3, ISO 27002 8.15, HIPAA §164.312(b), SOC2 CC7.2 | `packages/observability`; **PARTIAL** central spec — see §7 |

## 5. Policy Statements

1. **Secure SDLC.** Every change to a production-bound surface MUST pass the
   CI gate (`lint`, `typecheck`, `test`, `contract-tests`, `governance-check`,
   Trivy CRITICAL) before merge. Bypassing pre-commit hooks via `LEFTHOOK=0`
   is permitted ONLY for batch refactors and MUST be followed by a rerun.
2. **Outsourced development.** Contractors MUST sign the Agreement section
   (§9) and receive secure-coding orientation (see §7 GAP).
3. **Environment separation.** No production credentials, data, or secrets
   may be present in staging. Staging seeds MUST originate from
   `packages/staging-seed-*` (synthetic only).
4. **Test data.** Production PII/PHI MUST NOT be copied into non-prod
   environments. Anonymization, where applied, MUST be irreversible
   (k-anonymity ≥ 5 for quasi-identifiers).
5. **Dependency hygiene.** All HIGH/CRITICAL vulnerabilities MUST be
   remediated within SLA (CRITICAL: 7 days, HIGH: 30 days) OR waived in
   `ACTIVE_WAIVERS` with justification, expiry, and approver.
6. **Pre-deploy testing.** Container images MUST pass Trivy CRITICAL and
   the `governance-check` script before `az containerapp update`.
7. **Hardening.** Postgres, Redis, and Container Apps MUST follow the
   hardening standards in §7 (to be ratified). No public DB endpoints.
8. **Approved applications only.** Any new app under `apps/*` MUST be
   registered in `governance/portfolio/` and pass
   `scripts/control-plane-check.ts`. Orphaned apps are deleted.
9. **Security event audit trail.** Authentication events (login, lockout,
   session create/revoke), authorization decisions (role grant/revoke),
   secret access, and admin actions MUST emit structured audit records
   via the platform observability layer with actor, action, target,
   outcome, and correlation ID.

## 6. Procedures

- **Vulnerability triage:** [`tooling/security/supply-chain-policy.ts check-vulns`](../../tooling/security/supply-chain-policy.ts)
- **Adding a waiver:** Edit `ACTIVE_WAIVERS` in the same file; PR requires Security Lead approval.
- **Adding a new app:** Run `scripts/create-nzila-app.ts`, register in `governance/portfolio/`.
- **Vendor / outsourced commit:** PR template MUST include "Outsourced: yes" and CODEOWNERS review from Security Lead.

## 7. Known Gaps (Tracked Remediation)

| ID | Gap | Owner | Target |
|----|-----|-------|--------|
| ASP-G1 | No documented secure-coding training program (Statement #2) | Security Lead | 2026-Q3 |
| ASP-G2 | No formal hardening baseline for Postgres / Redis / Container Apps (Statement #7) | Platform Lead | 2026-Q3 |
| ASP-G3 | Audit-event taxonomy not centralized in a single spec (Statement #9) | Platform Lead | 2026-Q3 |
| ASP-G4 | Test-data anonymization technique not documented (relies on synthetic generation only) | Data Lead | 2026-Q3 |

## 8. Noncompliance

Violations of this policy are handled per [`SECURITY.md`](../../SECURITY.md)
incident response procedures. Repeated noncompliance may result in revocation
of repository write access.

## 9. Agreement

Contributors and contractors acknowledge this policy via accepting the
[`CONTRIBUTING.md`](../../CONTRIBUTING.md) terms when opening a Pull Request.

## 10. Revision History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-04-28 | Security Lead | Initial issue (derived from Info-Tech ASP template v4) |
