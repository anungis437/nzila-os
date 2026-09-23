# Phase G Status — staging only — PASS

**Generated:** 2026-09-23 ~14:40 ET (America/Toronto)
**PRODUCTION_TOUCHED:** false

## Traffic / image
| Field | Value |
|---|---|
| Revision | `nzila-os-union-eyes-staging--0000259` @ **100%** |
| Image | `sha256:48e6a029…` from **eae195f21** (deploy **35902008722**) |
| Health | **200** |
| Prior proof rev | `0000257` / `24513797a` (grievances PASS; docs still blocked) |
| Ignored | Failed run 35901045157 Cloudflare DNS preflight HTTP 000 |

## Matrix on 0000259
| Case | Result |
|---|---|
| org/current (Phase G roles) | **200** |
| grievances list + get A | **200** |
| document repository A | **200** |
| billing-cycle | **200** |
| unauth / unauthorized admin | **401 / 403** |
| cross-org grievance | **404** |
| MEMBER_A → DOC_B | **404** |

## Disposition
- `APP_SCHEMA_COMPATIBILITY` = **PASS**
- `FRESH_CANONICAL_STAGING` = **PASS**
- `PHASE_G_DEPLOYED_RUNTIME_AUTHORITY` = **PASS**
- `READY_FOR_POST_G_RELEASE_DISPOSITION` = **YES**
- Blockers: **none**
- Cleared: org deleted_at, org/current route, grievance RLS, document repository RLS (canonical route)

## Next
Snapshot lifecycle may begin; parent opens PR. No production.
