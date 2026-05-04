# Portfolio Live Health Stabilization Report

Date: 2026-05-04
Base Head: 84a9eab01

## Live Proof Run (post-activation attempts)
overallStatus: fail
endpoints: 44
failures: 17
blockingFindings: 0

## Domain Activation Outcomes
- Agrimo canonical domain bind attempt remains blocked by missing TXT ownership record.
- Veridian staging remains not deployed; DNS unresolved advisories persist.
- Zonga fallback /api/health remains 503 while /api/ready is healthy.
- Orchestrator fallback endpoints still timeout.

## Failure Matrix
| endpoint id | URL resolved | DNS result | HTTP status/error | policyCritical | app | suspected cause | owner/action |
|---|---|---|---|---|---|---|---|
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
| staging:veridian-site:root | https://staging-veridian-site.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-site | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target/domain binding or mark app not deployed |
| staging:veridian-site:health | https://staging-veridian-site.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-site | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target/domain binding or mark app not deployed |
| staging:veridian-care:root | https://staging-veridian-care.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-care | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target/domain binding or mark app not deployed |
| staging:veridian-care:health | https://staging-veridian-care.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-care | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target/domain binding or mark app not deployed |
| staging:veridian-admin:root | https://staging-veridian-admin.nzilaventures.com/ | unresolved | DNS lookup failed | False | veridian-admin | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target/domain binding or mark app not deployed |
| staging:veridian-admin:health | https://staging-veridian-admin.nzilaventures.com/api/health | unresolved | DNS lookup failed | False | veridian-admin | Custom DNS / domain binding unresolved | veridian, platform-ops / Platform-Ops: validate DNS target/domain binding or mark app not deployed |

## Stabilization Outcome
- Active product policy-critical runtime proof remains clear (0 blocking findings).
- Advisory runtime failures remain for domain activation and service readiness gaps.
- Next infra step for Agrimo activation is DNS TXT ownership record creation, then re-run hostname bind.
