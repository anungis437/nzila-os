# Nzila OS - Runtime Proof Summary

| Field | Value |
|-------|-------|
| Period | 2026-04 |
| Generated | Fri, 01 May 2026 13:15:03 GMT |
| Proof ID | 5ba0c13b-019e-49f9-a33a-d068acca0536 |
| Schema | v2 |
| Overall Health | Critical |
| Score | 75 / 100 |
| Grade | B |

## Scoring Breakdown

| Dimension | Weight | Earned | Bootstrap | Notes |
|-----------|-------:|-------:|:---------:|-------|
| release | 20 | 20 | no | 1 real ledger entries + 1 manifests |
| deploy | 20 | 10 | no | CI: 1/1 success; Azure: critical |
| health | 15 | 0 | no | health status: fail |
| drift | 15 | 15 | no | drift report: 0 items |
| restore | 10 | 10 | no | restore drill passed; age 0d |
| security | 10 | 10 | no | security checks pass |
| seal | 10 | 10 | no | snapshot present with sha256 integrity |

## Blocking Findings

- [deploy] [production] control-plane custom domain DNS unresolved: control.nzilaventures.com
- [health] [production] production:control-plane:root failed (dns)
- [metric:azure_runtime_status] critical (critical status)
- [metric:health_check_status] critical (fail status)

## Advisory Findings

- [health] health status: fail
- [deploy] partial — CI: 1/1 success; Azure: critical
- [deploy] [staging] expected app missing: flow (nzila-os-flow)
- [deploy] [staging] expected app missing: cfo (nzila-os-cfo)
- [deploy] [staging] expected app missing: agrimo (nzila-os-agrimo)
- [deploy] [staging] expected app missing: cora (nzila-os-cora)
- [deploy] [staging] expected app missing: trade (nzila-os-trade)
- [deploy] [staging] expected app missing: mobility (nzila-os-mobility)
- [deploy] [staging] expected app missing: orchestrator-api (nzila-os-orchestrator-api)
- [deploy] [staging] expected app missing: abr (nzila-os-abr)
- [health] [staging] staging:flow:root failed (dns)
- [health] [staging] staging:flow:health failed (dns)
- [health] [staging] staging:web:root failed (dns)
- [health] [staging] staging:web:health failed (dns)
- [health] [staging] staging:partners:root failed (dns)
- [health] [staging] staging:cfo:root failed (dns)
- [health] [staging] staging:cfo:health failed (dns)
- [health] [staging] staging:zonga:root failed (dns)
- [health] [staging] staging:zonga:health failed (dns)
- [health] [staging] staging:agrimo:root failed (dns)
- [health] [staging] staging:agrimo:health failed (dns)
- [health] [staging] staging:cora:root failed (dns)
- [health] [staging] staging:cora:health failed (dns)
- [health] [staging] staging:trade:root failed (dns)
- [health] [staging] staging:trade:health failed (dns)
- [health] [staging] staging:mobility:root failed (dns)
- [health] [staging] staging:mobility:health failed (dns)
- [health] [staging] staging:console:root failed (dns)
- [health] [staging] staging:control-plane:root failed (dns)
- [health] [staging] staging:orchestrator-api:root failed (dns)
- [health] [staging] staging:orchestrator-api:health failed (dns)
- [health] [staging] staging:abr:root failed (dns)
- [health] [staging] staging:abr:health failed (dns)
