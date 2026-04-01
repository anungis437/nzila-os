# PagerDuty Integration Runbook

## iSSDLC W2-10: Incident Alerting Webhook Configuration

### Overview

This runbook describes the PagerDuty webhook integration for critical security
and operational alerts from Azure Monitor and GitHub Actions.

---

## 1. Architecture

```
Azure Monitor Alert → Action Group → Webhook → PagerDuty Events API v2
GitHub Actions       → workflow failure → PagerDuty Events API v2
Sentinel Detection   → Automation Rule  → Logic App → PagerDuty Events API v2
```

---

## 2. PagerDuty Setup

### 2.1 Service Configuration

1. Create a PagerDuty service: **Nzila OS — Production**
2. Integration type: **Events API v2**
3. Copy the **Integration Key** (routing key)
4. Store in Azure Key Vault: `pagerduty-integration-key`

### 2.2 Escalation Policy

| Level | Responder              | Timeout |
|-------|------------------------|---------|
| 1     | On-call engineer       | 15 min  |
| 2     | Security Lead          | 30 min  |
| 3     | Engineering Manager    | 1 hour  |
| 4     | CTO                    | 2 hours |

---

## 3. Azure Monitor Webhook

### 3.1 Action Group (Bicep)

```bicep
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'nzila-pagerduty-ag'
  location: 'Global'
  properties: {
    groupShortName: 'PagerDuty'
    enabled: true
    webhookReceivers: [
      {
        name: 'PagerDuty'
        serviceUri: 'https://events.pagerduty.com/integration/<ROUTING_KEY>/enqueue'
        useCommonAlertSchema: true
      }
    ]
  }
}
```

### 3.2 Alert Rules Wired to PagerDuty

| Alert                         | Severity | KQL / Metric                              |
|-------------------------------|----------|--------------------------------------------|
| Brute-force auth failures     | Sev1     | `sentinel.bicep` → BruteForceDetection     |
| Cross-org data access         | Sev1     | `sentinel.bicep` → CrossOrgAccess           |
| AI budget exhaustion          | Sev2     | `sentinel.bicep` → AIBudgetExhaustion       |
| Audit trail tampering         | Sev0     | `sentinel.bicep` → AuditTrailTampering      |
| Container App unhealthy       | Sev2     | Metric: `RestartCount > 3 in 10m`          |
| Certificate expiry (30 days)  | Sev3     | Key Vault diagnostic event                  |

---

## 4. GitHub Actions Webhook

Add to critical workflow files (deploy-production, security scans):

```yaml
- name: Notify PagerDuty on failure
  if: failure()
  uses: PagerDuty/pagerduty-change-events-action@v1
  with:
    integration-key: ${{ secrets.PAGERDUTY_INTEGRATION_KEY }}
    change-summary: '${{ github.workflow }} failed on ${{ github.ref }}'
```

---

## 5. Sentinel Automation

### 5.1 Logic App Connector

1. Create Logic App: `nzila-pagerduty-connector`
2. Trigger: **When Azure Sentinel incident is created**
3. Action: HTTP POST to PagerDuty Events API v2
4. Payload mapping:

```json
{
  "routing_key": "<FROM_KEY_VAULT>",
  "event_action": "trigger",
  "payload": {
    "summary": "@{triggerBody()?['properties']?['title']}",
    "severity": "@{triggerBody()?['properties']?['severity']}",
    "source": "Azure Sentinel — Nzila OS",
    "component": "@{triggerBody()?['properties']?['relatedAnalyticRuleIds']}"
  }
}
```

---

## 6. Testing

### 6.1 Dry Run Checklist

- [ ] Send test event to PagerDuty Events API v2 (use `trigger` then `resolve`)
- [ ] Verify escalation policy triggers correctly
- [ ] Confirm Azure Monitor webhook delivers (check Action Group run history)
- [ ] Confirm Sentinel automation rule fires on test incident
- [ ] Verify GitHub Actions failure triggers PagerDuty event

### 6.2 Test Command

```bash
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_KEY",
    "event_action": "trigger",
    "payload": {
      "summary": "Test alert from Nzila OS runbook",
      "severity": "info",
      "source": "runbook-test"
    }
  }'
```

---

## 7. Maintenance

- Rotate PagerDuty integration key every 180 days (Key Vault auto-rotation)
- Review escalation policy quarterly
- Update webhook URLs if PagerDuty service is recreated
- Test end-to-end alerting monthly during on-call rotation handoff
