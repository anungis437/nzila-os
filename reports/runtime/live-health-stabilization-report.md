# Portfolio Live Health Stabilization Report

Date: 2026-05-04
Base Head: 797c4f0b2

## Live Proof Run
overallStatus: fail
endpoints: 44
failures: 18
blockingFindings: 0

## Root Cause Classification
- Repo/config defects fixed in this pass: Agrimo canonical staging inventory drift (reverted to staging blocked + fallback advisory).
- Remaining failures are external runtime infra/app availability blockers (DNS unresolved custom domains, fallback ingress 404/503/timeouts).
- No fake success applied; fallback remains non-policy-critical.

## Agrimo Verification Evidence
- Canonical DNS CNAME: staging-agrimo.nzilaventures.com -> jollydune-88c1e97f.canadacentral.azurecontainerapps.io
- Canonical A/AAAA reachability: missing in probe context (Invoke-WebRequest reports no data for :443).
- Fallback DNS A: nzila-os-agrimo... -> 20.175.163.48
- Fallback HTTP reachability: root=404, /api/health=503, /api/ready=200 (from live check-health run).
- ACA hostname binding list: []
- ACA ingress/custom-domain status: {   "customDomains": null,   "fqdn": "nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io" }
- Conclusion: canonical custom domain is not live-proof-ready; fallback remains advisory only.

## Failure Matrix
| endpoint id | URL resolved | DNS result | HTTP status/error | policyCritical | app | suspected cause | owner/action |
|---|---|---|---|---|---|---|---|
| staging:cfo:fallback:root | https://nzila-os-cfo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | cfo | Ingress timeout or upstream cold/unhealthy | cfo, platform-ops / Platform-Ops: inspect ACA ingress/revision health and timeouts |
| staging:zonga:fallback:health | https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | zonga | App-level degradation or readiness dependency unavailable | zonga, platform-ops / App owner: inspect readiness dependencies and backend health |
| staging:agrimo:fallback:root | https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | 404 | False | agrimo | Ingress route exposure mismatch (root path not served) | agrimo, platform-ops / App owner + Platform-Ops: align probe path or ingress behavior |
| staging:agrimo:fallback:health | https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | agrimo | App-level degradation or readiness dependency unavailable | agrimo, platform-ops / App owner: inspect readiness dependencies and backend health |
| staging:cora:fallback:root | https://nzila-os-cora.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | 404 | False | cora | Ingress route exposure mismatch (root path not served) | cora, platform-ops / App owner + Platform-Ops: align probe path or ingress behavior |
| staging:cora:fallback:health | https://nzila-os-cora.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | cora | App-level degradation or readiness dependency unavailable | cora, platform-ops / App owner: inspect readiness dependencies and backend health |
| staging:trade:fallback:root | https://nzila-os-trade.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | 404 | False | trade | Ingress route exposure mismatch (root path not served) | trade, platform-ops / App owner + Platform-Ops: align probe path or ingress behavior |
| staging:trade:fallback:health | https://nzila-os-trade.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | A:20.175.163.48 | 503 | False | trade | App-level degradation or readiness dependency unavailable | trade, platform-ops / App owner: inspect readiness dependencies and backend health |
| staging:mobility:fallback:root | https://nzila-os-mobility.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | 404 | False | mobility | Ingress route exposure mismatch (root path not served) | mobility, platform-ops / App owner + Platform-Ops: align probe path or ingress behavior |
| staging:orchestrator-api:fallback:root | https://nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ | A:20.175.163.48 | This operation was aborted | False | orchestrator-api | Ingress timeout or upstream cold/unhealthy | platform-admin, platform-ops / Platform-Ops: inspect ACA ingress/revision health and timeouts |
| staging:orchestrator-api:fallback:health | https://nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/health | A:20.175.163.48 | This operation was aborted | False | orchestrator-api | Ingress timeout or upstream cold/unhealthy | platform-admin, platform-ops / Platform-Ops: inspect ACA ingress/revision health and timeouts |
| staging:orchestrator-api:fallback:ready | https://nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/ready | A:20.175.163.48 | This operation was aborted | False | orchestrator-api | Ingress timeout or upstream cold/unhealthy | platform-admin, platform-ops / Platform-Ops: inspect ACA ingress/revision health and timeouts |
| staging:veridian-site:root | https://staging-veridian-site.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-site | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target and domain binding before promotion |
| staging:veridian-site:health | https://staging-veridian-site.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-site | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target and domain binding before promotion |
| staging:veridian-care:root | https://staging-veridian-care.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-care | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target and domain binding before promotion |
| staging:veridian-care:health | https://staging-veridian-care.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-care | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target and domain binding before promotion |
| staging:veridian-admin:root | https://staging-veridian-admin.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-admin | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target and domain binding before promotion |
| staging:veridian-admin:health | https://staging-veridian-admin.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-admin | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target and domain binding before promotion |

## Stabilization Outcome
- Health proof generator behavior is now honest: canonical Agrimo is blocked, fallback advisory only.
- Live proof still fails due runtime infra/app health across multiple staging endpoints.
- Production policy-critical endpoints in this snapshot are passing.
