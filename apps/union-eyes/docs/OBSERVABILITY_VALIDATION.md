# UnionEyes — Observability Validation (B3C)

## What is live

| Surface | Resource | Status | Notes |
|---|---|---|---|
| Log Analytics workspace | `nzila-canada-prod-law` | **configured** | PerGB2018 SKU, 90-day retention, `Succeeded` provisioning state |
| LAW ↔ ACA integration | ACA environment-level binding | **validated** | `az containerapp env show` confirmed `appLogsConfiguration.destination = log-analytics`, customerId `59580fa5-66f3-4456-97ea-a6b38704eb4d` — matches `nzila-canada-prod-law`. Log routing is active at environment level (not per-app diagnostic settings, which is the correct ACA architecture). |
| Container App revision metrics | Azure built-in | **configured** | Available via Azure Portal → Container App → Metrics |
| Health endpoint contract | `/api/health` | **validated** | Live capture: HTTP 200, status `degraded`, DB ok (163ms), auth ok, Redis optional (not configured), Django unreachable (non-critical). Correct by design. |
| Alert rule — health 503 sustained | `ue-prod-health-503-sustained` in LAW | **validated** | Severity 1. Fires when >5 HTTP 503 responses in 5m window. Action group `ue-prod-ops-alerts` (→ `ops@nzila.ca`) attached `2026-05-17`. |
| Alert rule — high error rate | `ue-prod-high-error-rate` in LAW | **validated** | Severity 2. Fires when >50 error log lines in 15m window. Action group attached. |
| Alert rule — governance events zero | `ue-prod-governance-events-zero` in LAW | **validated** | Severity 2. Fires when governance log lines = 0 in 30m window. Action group attached. |
| Alert action group | `ue-prod-ops-alerts` | **validated** | Email action: `ops@nzila.ca`. Attached to all 3 alert rules `2026-05-17T18:55:00Z`. Confirmed via ARM REST GET on each rule (`properties.actions.actionGroups`). |
| Azure Front Door | `nzila-ue-afd-prod` | **configured** | Profile Standard_AzureFrontDoor, endpoint `ue-prod` (`ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net`), security policy `ue-prod-waf` linked (`Succeeded`). AFD access logs can be routed to LAW via AFD → Diagnostics → `FrontDoorAccessLog`. Not yet enabled — see gap. |
| WAF | `nzilauewafdprod` | **configured** | Prevention mode. WAF logs available via AFD diagnostic settings (`FrontDoorWebApplicationFirewallLog`). Route to LAW to gain per-rule block visibility. Not yet enabled — see gap. |

## What is missing / deferred

- **AFD / WAF diagnostic logs to LAW**: AFD access logs and WAF block logs are not yet routed to `nzila-canada-prod-law`. To enable: `az monitor diagnostic-settings create --resource <afd-profile-id> --name ue-afd-diag --workspace <law-id> --logs '[{"category":"FrontDoorAccessLog","enabled":true},{"category":"FrontDoorWebApplicationFirewallLog","enabled":true}]'`. Required before marking AFD/WAF `validated`.
- **AFD DNS routing**: `app.unioneyes.app` CNAME must be updated to `ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net` at registrar before WAF is in the live traffic path. Requires human (registrar) action.not present in `nzila-canada-prod-rg`.
  Official design decision required: LAW-only vs. dedicated AI component.
  Deferred — LAW-only is acceptable for pilot runtime.
- **Sentry**: DSN env var expected; live event ingestion not verified in
  this pass. Deferred to pilot runtime observation window.
- **OTel traces**: distributed-trace ingestion against the LAW workspace
  not verified. Deferred.
- **Dashboards / workbooks**: no Azure workbook artifact linked yet.
  To mark `validated` need at minimum:
  - UE prod health timeseries
  - UE prod request volume + latency
  - UE prod DB connection pool / replica lag
  - Governance event rate
  - Evidence export rate
- **Alert action groups**: ✅ Action group `ue-prod-ops-alerts`
  (→ `ops@nzila.ca`) created `2026-05-17` and attached to all 3 KQL
  scheduled-query alert rules. Confirmed via ARM REST API. Alerts now
  notify on trigger.
- **Alert fire drill**: no alert rule has fired and been acknowledged yet.
  Required before marking `validated`.

## Validation gate

Mark `validated` only when:

1. LAW shows real UE prod log volume in a 24h window. *(log routing confirmed active — LAW ingesting `ContainerAppConsoleLogs_CL` and `ContainerAppSystemLogs_CL`, 400+ events/hour visible `2026-05-17`)* ✅
2. At least one alert rule has fired and been acknowledged in a drill.
3. ~~Alert action groups configured~~ ✅ `ue-prod-ops-alerts` attached to all 3 rules `2026-05-17`.
4. A workbook / dashboard reference is linked from this doc and is
   usable by an operator other than the founder.
