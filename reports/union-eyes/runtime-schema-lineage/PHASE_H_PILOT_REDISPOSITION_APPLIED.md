# PHASE_H_PILOT_REDISPOSITION_APPLIED

**Status: APPLIED**  
Applied at `2026-09-23T22:03:50Z` UTC / 2026-09-23, ~6:03 p.m. ET  
Approver: `Aubert / Nzila designated pilot authority`

## Final controlled pilot envelope

| Control | Applied value |
|---|---|
| PILOT_END | **2026-10-07** |
| PILOT_SCOPE | **STAGING_ONLY** |
| PILOT_ORGANIZATIONS | **<=2** |
| EXPIRED_WAIVERS | **RISK_ACCEPTED_FOR_PILOT** |
| DEPENDENCY_VULNERABILITIES | **RISK_ACCEPTED_FOR_PILOT** |
| GOVERNANCE_GATE | **EXCEPTION_APPROVED_FOR_PILOT** |
| ROLLBACK_SUPPORT_CONTROLS | **PASS** |
| CONTROLLED_PILOT_READINESS | **READY_WITH_LIMITATIONS** |
| LIUNA_DEMO_READINESS | **READY_WITH_LIMITATIONS** |
| GENERAL_PRODUCTION_READINESS | **BLOCKED** |
| TECHNICAL_ACCESS_CONTROL | **PASS** |
| EXTERNAL_SPECIALIST_MATRIX | **10/10 PASS** |
| PR #797 merge | **NOT_AUTHORIZED** |
| Production promotion / data migration | **NOT_AUTHORIZED** |
| ACA rollback dry-run | **OPTIONAL_NOT_RUN**; not a prerequisite |

Approval is recorded in `PHASE_H_PILOT_GOVERNANCE_PACKET` and `PHASE_H_PILOT_ROLLBACK_SUPPORT_SIGNOFF`. `awaiting_human_approval=false`.

The 19 expired waivers and `adm-zip` high remain unresolved debt; residual risk is accepted for this envelope only. Risk acceptances expire 2026-10-07 and create no production precedent.

**Next activity:** pilot execution/preflight, not another readiness-remediation phase.
