# Union Eyes — legacy production exposure assessment (2026-11-04)

> **Read-only assessment.** Required "immediately" by the New Azure Subscription Migration Directive
> (2026-11-04, §4). No Azure resource was changed, no secret was read, and no database was queried.
> Every containment option below affects service availability and therefore needs the documented
> impact assessment in §4 and explicit authorization before it is applied.

Scope: subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, resource group `nzila-canada-prod-rg`.

## 1. What is exposed

| Item | Observation | Method |
| --- | --- | --- |
| App `nzila-os-union-eyes-prod` | Revision `--0000249`, 2 replicas, `/api/health` and `/api/ready` 200, `environment: production` | `az containerapp revision list`; HTTPS GET |
| Build | Source `c890d1a2` (2026-10-05, CHG-2026-0109 emergency restore), 195 commits behind `main` | `/api/version`; `git log` |
| Missing fixes | Neither #948 (fail-open legacy RLS policies on deadline-engine tables, merged 2026-10-19) nor #981 (deadline convergence RLS, merged 2026-10-22) is in the build | `git merge-base --is-ancestor` |
| Direct reachability | App FQDN `nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io` answers the internet: external ingress, 0 IP restrictions, no container probes | `az containerapp show` |
| Edge | Front Door `nzila-ue-afd-prod` is **Standard** with WAF policy `nzilauewafdprod` (Prevention, enabled). `app.unioneyes.app` fails TLS from a client (certificate name mismatch) although the custom domain reads Approved/Succeeded; Front Door logged **no** access-log rows in the last 7 days | `curl`; `az afd custom-domain list`; Log Analytics |
| Database `nzila-os-union-eyes-prod-db` | PG 16, zone-redundant HA, 30-day PITR, geo backup; **public network access**, single firewall rule `AllowAllAzureServices` (0.0.0.0) | `az postgres flexible-server` |
| Traffic | ~538k requests in 30 days (2xx 503k, 3xx 17k, 4xx 17k, 5xx 99); 0 on 2026-10-28..30; today 344–887 per hour with no overnight dip | `az monitor metrics` (`Requests`) |
| Data volume | `storage_used` ≈ 16.5 GB; 10–14 active connections daily | `az monitor metrics` |
| Egress | Environment static IP `4.174.220.122`; app outbound `20.104.39.81` | `az containerapp` |

## 2. What this does and does not establish

- **Established:** all current traffic reaches the app directly, bypassing Front Door and its WAF;
  the build predates two tenant-isolation fixes; the database accepts connections from any Azure
  service with valid credentials.
- **Traffic shape:** the flat hourly rate across Canadian night-time suggests automated clients
  (crawlers, scanners or polling integrations) rather than staff. Application console logs are not
  in the workspace, so request sources and authenticated sessions **could not be attributed**.
- **Not established:** whether `nzila_os_prod` contains real member or customer data, and whether the
  RLS defect in the old build is reachable through an authenticated path in production. Both need
  read access to the database under a change record (directive decision D4).

## 3. Risk

| Risk | Likelihood | Impact | Note |
| --- | --- | --- | --- |
| Cross-tenant read or forged write on deadline-engine tables (file 29 §2 row 6) | Unknown; requires an authenticated path with empty organization context | High if real tenants exist | Fixed in source (#948, #981), not deployed here |
| WAF bypass via the direct FQDN | Certain (all traffic does this today) | Medium | WAF is configured but receives no traffic |
| Database reachable from any Azure tenant's services | Possible | High if credentials leak | No private access, no IP allow-list |
| Unattributed traffic | Certain | Unknown | No application request logs |

## 4. Containment options and availability impact (none applied)

| Option | Action | Availability impact | Reversible | Needs |
| --- | --- | --- | --- | --- |
| C1 | Restrict the app ingress to Front Door (service tag `AzureFrontDoor.Backend` plus `X-Azure-FDID` check) | **Total for current traffic**: the direct FQDN stops answering and `app.unioneyes.app` already fails TLS, so the service becomes unreachable until C2 lands | Yes (remove rule) | Change record + authorization |
| C2 | Repair the `app.unioneyes.app` certificate/route association on Front Door, then apply C1 | None if C2 is verified before C1 | Yes | Change record + authorization |
| C3 | Replace `AllowAllAzureServices` on the database with the app's outbound IP `20.104.39.81` (verify the egress IP first) | None if the IP is right; outage if wrong (connections refused) | Yes (restore rule) | Change record + authorization |
| C4 | Scale the app to zero / deactivate the revision | **Total** service outage | Yes | Product-owner decision + authorization |
| C5 | Redeploy a build containing #948/#981 | Restart; schema migrations 0015/0019 required first | Forward-only schema | Not authorized by the directive (production deployment) |
| C6 | Enable application console logs to the workspace | None | Yes | Change record |

**Recommendation for decision:** C6 now (visibility, no impact), then C2 → C1 and C3 in one
approved window. C4 only if D4 shows real member data and C1–C3 cannot be applied promptly.
C5 is outside this directive.

## 5. Open items

- D4 data disposition (read-only database inspection under a change record).
- Owner and window for C1–C3 and C6.
- Front Door Standard has no Private Link; production on the new subscription uses Premium (D6).
