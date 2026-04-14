// ──────────────────────────────────────────────────────────────────────────────
// Azure Monitor Alert Rules — operational health for Nzila Container Apps
//
// Alerts on: 5xx rate, P99 latency, CPU saturation, memory pressure,
// replica scaling failures, and health probe failures.
//
// Deploy: automatically included from main.bicep
// ──────────────────────────────────────────────────────────────────────────────

param location string = resourceGroup().location
param logAnalyticsWorkspaceId string
param actionGroupId string = ''
param env string

@description('Alert email recipients (comma-separated)')
param alertEmails array = []

// ── Action Group (notification channel) ──────────────────────────────────

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (actionGroupId == '') {
  name: 'nzila-${env}-ops-alerts'
  location: 'global'
  properties: {
    groupShortName: 'nzila-ops'
    enabled: true
    emailReceivers: [
      for (email, i) in alertEmails: {
        name: 'ops-${i}'
        emailAddress: email
        useCommonAlertSchema: true
      }
    ]
  }
}

var resolvedActionGroupId = actionGroupId != '' ? actionGroupId : actionGroup.id

// ── Alert: HTTP 5xx Error Rate > 5% ─────────────────────────────────────

resource alert5xx 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'nzila-${env}-5xx-rate'
  location: location
  properties: {
    displayName: 'Nzila ${env} — HTTP 5xx Error Rate > 5%'
    description: 'Fires when any Container App returns >5% server errors over 5min'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            ContainerAppConsoleLogs_CL
            | where Log_s has "status="
            | parse Log_s with * "status=" StatusCode:int " " *
            | summarize Total = count(), Errors = countif(StatusCode >= 500) by bin(TimeGenerated, 5m)
            | where Total > 50
            | extend ErrorRate = (Errors * 100.0) / Total
            | where ErrorRate > 5
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [resolvedActionGroupId]
    }
  }
}

// ── Alert: P99 Latency > 2s ─────────────────────────────────────────────

resource alertLatency 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'nzila-${env}-p99-latency'
  location: location
  properties: {
    displayName: 'Nzila ${env} — API P99 Latency > 2s'
    description: 'Fires when p99 request duration exceeds 2 seconds over 10min'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            ContainerAppConsoleLogs_CL
            | where Log_s has "duration_ms="
            | parse Log_s with * "duration_ms=" DurationMs:double " " *
            | summarize P99 = percentile(DurationMs, 99) by bin(TimeGenerated, 10m)
            | where P99 > 2000
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 2
            minFailingPeriodsToAlert: 2
          }
        }
      ]
    }
    actions: {
      actionGroups: [resolvedActionGroupId]
    }
  }
}

// ── Alert: Container CPU > 85% sustained ────────────────────────────────

resource alertCpu 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'nzila-${env}-cpu-saturation'
  location: location
  properties: {
    displayName: 'Nzila ${env} — Container CPU > 85% (sustained)'
    description: 'Fires when container CPU exceeds 85% for 10+ minutes'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            ContainerAppSystemLogs_CL
            | where Reason_s == 'ContainerMetrics'
            | extend CpuPercent = todouble(parse_json(Log_s).cpuPercent)
            | where isnotempty(CpuPercent)
            | summarize AvgCpu = avg(CpuPercent) by ContainerAppName_s, bin(TimeGenerated, 5m)
            | where AvgCpu > 85
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 2
            minFailingPeriodsToAlert: 2
          }
        }
      ]
    }
    actions: {
      actionGroups: [resolvedActionGroupId]
    }
  }
}

// ── Alert: Container Memory > 90% ───────────────────────────────────────

resource alertMemory 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'nzila-${env}-memory-pressure'
  location: location
  properties: {
    displayName: 'Nzila ${env} — Container Memory > 90%'
    description: 'Fires when container memory exceeds 90% — risk of OOM'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            ContainerAppSystemLogs_CL
            | where Reason_s == 'ContainerMetrics'
            | extend MemPercent = todouble(parse_json(Log_s).memoryPercent)
            | where isnotempty(MemPercent)
            | summarize AvgMem = avg(MemPercent) by ContainerAppName_s, bin(TimeGenerated, 5m)
            | where AvgMem > 90
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [resolvedActionGroupId]
    }
  }
}

// ── Alert: Health Probe Failures ────────────────────────────────────────

resource alertHealthProbe 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'nzila-${env}-health-probe-failure'
  location: location
  properties: {
    displayName: 'Nzila ${env} — Health Probe Failures'
    description: 'Fires when health checks return degraded (503) for 3+ consecutive checks'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT2M'
    windowSize: 'PT5M'
    scopes: [logAnalyticsWorkspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            ContainerAppConsoleLogs_CL
            | where Log_s has "/api/health" or Log_s has "/api/auth_core/health"
            | where Log_s has "status=503" or Log_s has "degraded"
            | summarize FailCount = count() by ContainerAppName_s, bin(TimeGenerated, 5m)
            | where FailCount >= 3
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [resolvedActionGroupId]
    }
  }
}

// ── Outputs ─────────────────────────────────────────────────────────────
output actionGroupId string = resolvedActionGroupId
