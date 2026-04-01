// ──────────────────────────────────────────────────────────────────────────────
// W1-7: Azure Sentinel + Log Analytics Workspace
// Provides SIEM, KQL detection rules, and security dashboards.
// ──────────────────────────────────────────────────────────────────────────────

param workspaceName string
param location string
param retentionDays int = 90
param enableSentinel bool = true

// ── Log Analytics Workspace ──────────────────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ── Sentinel (SecurityInsights) ──────────────────────────────────────────

resource sentinel 'Microsoft.SecurityInsights/onboardingStates@2024-03-01' = if (enableSentinel) {
  scope: logAnalytics
  name: 'default'
  properties: {}
}

// ── KQL Detection Rules ─────────────────────────────────────────────────

// Rule 1: Brute-force authentication attempts
resource bruteForceRule 'Microsoft.SecurityInsights/alertRules@2024-03-01' = if (enableSentinel) {
  scope: logAnalytics
  name: 'nzila-brute-force-detection'
  kind: 'Scheduled'
  properties: {
    displayName: 'Nzila — Brute-Force Authentication Attempts'
    description: 'Detects >10 failed auth attempts from a single IP within 5 minutes'
    severity: 'High'
    enabled: true
    query: '''
      ContainerAppConsoleLogs_CL
      | where Log_s contains "auth" and Log_s contains "failed"
      | parse Log_s with * "ip=" ClientIP:string " " *
      | where isnotempty(ClientIP)
      | summarize FailedAttempts = count() by ClientIP, bin(TimeGenerated, 5m)
      | where FailedAttempts > 10
    '''
    queryFrequency: 'PT5M'
    queryPeriod: 'PT5M'
    triggerOperator: 'GreaterThan'
    triggerThreshold: 0
    tactics: ['CredentialAccess']
  }
}

// Rule 2: Cross-org data access anomaly
resource crossOrgRule 'Microsoft.SecurityInsights/alertRules@2024-03-01' = if (enableSentinel) {
  scope: logAnalytics
  name: 'nzila-cross-org-access'
  kind: 'Scheduled'
  properties: {
    displayName: 'Nzila — Anomalous Cross-Organization Data Access'
    description: 'Detects user accessing data from multiple organizations within a short window'
    severity: 'High'
    enabled: true
    query: '''
      ContainerAppConsoleLogs_CL
      | where Log_s contains "orgId"
      | parse Log_s with * "userId=" UserId:string " " * "orgId=" OrgId:string " " *
      | where isnotempty(UserId) and isnotempty(OrgId)
      | summarize DistinctOrgs = dcount(OrgId), OrgList = make_set(OrgId) by UserId, bin(TimeGenerated, 15m)
      | where DistinctOrgs > 2
    '''
    queryFrequency: 'PT15M'
    queryPeriod: 'PT15M'
    triggerOperator: 'GreaterThan'
    triggerThreshold: 0
    tactics: ['LateralMovement']
  }
}

// Rule 3: AI budget exhaustion alert
resource aiBudgetRule 'Microsoft.SecurityInsights/alertRules@2024-03-01' = if (enableSentinel) {
  scope: logAnalytics
  name: 'nzila-ai-budget-exhaustion'
  kind: 'Scheduled'
  properties: {
    displayName: 'Nzila — AI Budget Exhaustion (NZ-RISK-008)'
    description: 'Detects orgs consuming >80% of AI budget within 24h window'
    severity: 'Medium'
    enabled: true
    query: '''
      ContainerAppConsoleLogs_CL
      | where Log_s contains "nzila.ai.metric"
      | parse Log_s with * "costUsd=" CostUsd:double " " * "orgId=" OrgId:string " " *
      | where isnotempty(OrgId)
      | summarize TotalCost = sum(CostUsd) by OrgId, bin(TimeGenerated, 1h)
      | where TotalCost > 50.0
    '''
    queryFrequency: 'PT1H'
    queryPeriod: 'PT1H'
    triggerOperator: 'GreaterThan'
    triggerThreshold: 0
    tactics: ['Impact']
  }
}

// Rule 4: Audit trail tampering attempt
resource auditTamperRule 'Microsoft.SecurityInsights/alertRules@2024-03-01' = if (enableSentinel) {
  scope: logAnalytics
  name: 'nzila-audit-tamper-detection'
  kind: 'Scheduled'
  properties: {
    displayName: 'Nzila — Audit Trail Hash Chain Integrity Violation'
    description: 'Detects hash chain breaks in audit event log'
    severity: 'Critical'
    enabled: true
    query: '''
      ContainerAppConsoleLogs_CL
      | where Log_s contains "hash_chain_broken" or Log_s contains "audit_integrity_error"
      | project TimeGenerated, Log_s
    '''
    queryFrequency: 'PT5M'
    queryPeriod: 'PT5M'
    triggerOperator: 'GreaterThan'
    triggerThreshold: 0
    tactics: ['DefenseEvasion']
  }
}

output workspaceId string = logAnalytics.properties.customerId
output workspaceKey string = listKeys(logAnalytics.id, '2023-09-01').primarySharedKey
output workspaceResourceId string = logAnalytics.id
