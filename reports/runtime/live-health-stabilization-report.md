# Portfolio Live Health Stabilization Report

Date: 2026-05-04
Head: 8ef775a68

## Live Proof Run
overallStatus: fail
endpoints: 44
failures: 20
blockingFindings: 0
activeProductFailures: 9

## Active Product Summary
- Union Eyes: staging and production probes passing; no active failures in this run.
- Zonga: fallback /api/health remains 503 with degraded payload while /api/ready is 200 (readiness dependency defect, advisory).
- Agrimo: fallback /api/ready is 200; custom staging domain readiness cannot be validated and ACA has no custom domain binding.
- Veridian: no veridian ACA apps found in staging RG; staging domains unresolved; keep synthetic demo not deployed posture.

## Infra Evidence
- Agrimo custom domain DNS answer: CNAME
- Agrimo custom domain /api/ready: unreachable
- Agrimo fallback /api/ready: 200
- Agrimo hostname bindings: []
- Orchestrator revision state: {   "latestReadyRevisionName": "nzila-os-orchestrator-api--6tuthjj",   "latestRevisionName": "nzila-os-orchestrator-api--0000005",   "minReplicas": 1 }
- Veridian ACA apps detected: none

## Failure Matrix
| endpoint id | URL | DNS result | HTTP status/error | policyCritical | app | suspected cause | classification | recommended owner/action |
|---|---|---|---|---|---|---|---|---|
| staging:flow:root | https://staging-flow.nzilaventures.com/ | CNAME→A:20.175.163.48 | This operation was aborted | False | flow | Custom domain ingress timeout; fallback ACA domain healthy | expected advisory fallback behavior | flow, platform-ops / No blocker for active launch gate; custom domain TLS/ingress timeout; fallback domain passing |
| staging:cfo:fallback:root | https://nzila-os-cfo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | cfo | Ingress timeout or upstream slow/unhealthy | expected advisory fallback behavior | cfo, platform-ops / No blocker for active launch gate; keep advisory fallback classification and prevent policyCritical promotion |
| staging:zonga:fallback:health | https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | zonga | App-level degradation or dependency unavailable | app readiness defect | zonga, platform-ops / App owner + Platform-Ops: inspect health dependency checks/env vars; keep auth/org-isolation hardening intact |
| staging:agrimo:fallback:root | https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | agrimo | Ingress timeout or upstream slow/unhealthy | expected advisory fallback behavior | agrimo, platform-ops / No blocker for active launch gate; keep advisory fallback classification and prevent policyCritical promotion |
| staging:agrimo:fallback:health | https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | agrimo | App-level degradation or dependency unavailable | app readiness defect | agrimo, platform-ops / App owner + Platform-Ops: inspect health dependency checks/env vars; keep auth/org-isolation hardening intact |
| staging:cora:fallback:root | https://nzila-os-cora.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | cora | Ingress timeout or upstream slow/unhealthy | expected advisory fallback behavior | cora, platform-ops / No blocker for active launch gate; keep advisory fallback classification and prevent policyCritical promotion |
| staging:cora:fallback:health | https://nzila-os-cora.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | cora | App-level degradation or dependency unavailable | app readiness defect | cora, platform-ops / App owner + Platform-Ops: inspect health dependency checks/env vars; keep auth/org-isolation hardening intact |
| staging:trade:fallback:root | https://nzila-os-trade.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | trade | Ingress timeout or upstream slow/unhealthy | expected advisory fallback behavior | trade, platform-ops / No blocker for active launch gate; keep advisory fallback classification and prevent policyCritical promotion |
| staging:trade:fallback:health | https://nzila-os-trade.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | trade | App-level degradation or dependency unavailable | app readiness defect | trade, platform-ops / App owner + Platform-Ops: inspect health dependency checks/env vars; keep auth/org-isolation hardening intact |
| staging:mobility:fallback:root | https://nzila-os-mobility.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | mobility | Ingress timeout or upstream slow/unhealthy | expected advisory fallback behavior | mobility, platform-ops / No blocker for active launch gate; keep advisory fallback classification and prevent policyCritical promotion |
| staging:orchestrator-api:fallback:root | https://nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | orchestrator-api | Ingress timeout or upstream slow/unhealthy | ACA ingress/revision blocker | platform-admin, platform-ops / Platform-Ops: inspect latest vs ready revision traffic, ingress timeout, and dependency startup latency |
| staging:orchestrator-api:fallback:health | https://nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/health | A:20.175.163.48 | This operation was aborted | False | orchestrator-api | Ingress timeout or upstream slow/unhealthy | ACA ingress/revision blocker | platform-admin, platform-ops / Platform-Ops: inspect latest vs ready revision traffic, ingress timeout, and dependency startup latency |
| staging:orchestrator-api:fallback:ready | https://nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ready | A:20.175.163.48 | This operation was aborted | False | orchestrator-api | Ingress timeout or upstream slow/unhealthy | ACA ingress/revision blocker | platform-admin, platform-ops / Platform-Ops: inspect latest vs ready revision traffic, ingress timeout, and dependency startup latency |
| staging:abr:fallback:root | https://nzila-os-abr.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | abr | Ingress timeout or upstream slow/unhealthy | expected advisory fallback behavior | abr, platform-ops / No blocker for active launch gate; keep advisory fallback classification and prevent policyCritical promotion |
| staging:veridian-site:root | https://staging-veridian-site.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-site | Custom DNS / domain binding unresolved | DNS/custom-domain blocker | veridian, platform-ops / Platform-Ops: keep synthetic demo app not deployed / DNS pending status; only promote when ACA app exists and domain/TLS bind succeed |
| staging:veridian-site:health | https://staging-veridian-site.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-site | Custom DNS / domain binding unresolved | DNS/custom-domain blocker | veridian, platform-ops / Platform-Ops: keep synthetic demo app not deployed / DNS pending status; only promote when ACA app exists and domain/TLS bind succeed |
| staging:veridian-care:root | https://staging-veridian-care.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-care | Custom DNS / domain binding unresolved | DNS/custom-domain blocker | veridian, platform-ops / Platform-Ops: keep synthetic demo app not deployed / DNS pending status; only promote when ACA app exists and domain/TLS bind succeed |
| staging:veridian-care:health | https://staging-veridian-care.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-care | Custom DNS / domain binding unresolved | DNS/custom-domain blocker | veridian, platform-ops / Platform-Ops: keep synthetic demo app not deployed / DNS pending status; only promote when ACA app exists and domain/TLS bind succeed |
| staging:veridian-admin:root | https://staging-veridian-admin.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-admin | Custom DNS / domain binding unresolved | DNS/custom-domain blocker | veridian, platform-ops / Platform-Ops: keep synthetic demo app not deployed / DNS pending status; only promote when ACA app exists and domain/TLS bind succeed |
| staging:veridian-admin:health | https://staging-veridian-admin.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-admin | Custom DNS / domain binding unresolved | DNS/custom-domain blocker | veridian, platform-ops / Platform-Ops: keep synthetic demo app not deployed / DNS pending status; only promote when ACA app exists and domain/TLS bind succeed |

## Stabilization Outcome
- No policy-critical blocking findings are present.
- Advisory failures remain, dominated by fallback endpoint behavior, Veridian not-deployed DNS, orchestrator ingress/revision timeouts, and flow custom-domain ingress timeout (fallback domain healthy).
- Live readiness is not overstated: unresolved domain/TLS/deployment blockers remain explicitly documented.
