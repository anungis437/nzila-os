// Production alerts for Union Eyes V2. Log queries use the exact patterns validated against the
// staging application's real logs (see docs/union-eyes/production/UE_PRODUCTION_HARDENING_PACKAGE.json).
// Signals with no log line (ClamAV outage, database availability, cron job failure) use platform
// metrics/system logs instead of guessing a log pattern.
param location string
param logAnalyticsId string
param actionGroupId string
param appName string
param appId string
param clamavAppId string
param pgServerId string
param prefix string
param tags object = {}

var base = 'ContainerAppConsoleLogs_CL | where ContainerAppName_s == "${appName}"'

var logAlerts = [
  {
    name: 'unexpected-5xx'
    severity: 1
    description: 'API error responses with status >= 500 (501 NOT_IMPLEMENTED is intentional and excluded).'
    query: '${base} | where Log_s has "API Error Response" | extend j = parse_json(Log_s) | extend sc = toint(j.context.statusCode) | where sc >= 500 and sc != 501'
    window: 'PT5M'
    threshold: 0
  }
  {
    name: 'redis-unavailable'
    severity: 1
    description: 'Rate-limiter Redis errors. Rate-limited routes fail closed while this fires.'
    query: '${base} | where Log_s has_any ("[rate-limiter] ioredis error", "Rate limit check failed", "Rate limiting service")'
    window: 'PT5M'
    threshold: 0
  }
  {
    name: 'stripe-webhook-failure'
    severity: 1
    description: 'Stripe webhook rejected or failing (bad signature, mismatched metadata, missing secret).'
    query: '${base} | where Log_s has "[stripe-webhook]" | extend j = parse_json(Log_s) | where tostring(j.level) in ("error", "warn")'
    window: 'PT5M'
    threshold: 0
  }
  {
    name: 'resend-failure'
    severity: 2
    description: 'Email provider failures, including reminder delivery that leads to dead-lettering.'
    query: '${base} | where Log_s has_any ("Error sending email", "deadline-engine.email")'
    window: 'PT15M'
    threshold: 0
  }
  {
    name: 'database-errors'
    severity: 1
    description: 'Database connectivity or query failures surfaced by the application.'
    query: '${base} | where Log_s has_any ("ECONNREFUSED", "ETIMEDOUT", "terminating connection", "connection terminated", "Failed query")'
    window: 'PT5M'
    threshold: 2
  }
  {
    name: 'audit-persistence-failure'
    severity: 1
    description: 'A mandatory canonical audit write failed (the protected mutation is rolled back).'
    query: '${base} | where Log_s has "Failed query" and Log_s has "audit_logs"'
    window: 'PT5M'
    threshold: 0
  }
  {
    name: 'cron-job-failed'
    severity: 2
    description: 'The scheduled deadline-reminder job exited non-zero (UNVALIDATED pattern: validate after first production run).'
    query: 'ContainerAppSystemLogs_CL | where ContainerAppName_s has "cron-deadlines" or JobName_s has "cron-deadlines" | where Reason_s in ("ContainerTerminated", "JobExecutionFailed") | where Log_s has_any ("exit code", "ExitCode", "Failed")'
    window: 'PT15M'
    threshold: 0
  }
]

resource logRules 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = [for a in logAlerts: {
  name: '${prefix}-${a.name}'
  location: location
  tags: tags
  properties: {
    displayName: '${prefix} ${a.name}'
    description: a.description
    severity: a.severity
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: a.window
    scopes: [logAnalyticsId]
    autoMitigate: true
    criteria: {
      allOf: [
        {
          query: a.query
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: a.threshold
          failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
        }
      ]
    }
    actions: { actionGroups: [actionGroupId] }
  }
}]

resource dbAlive 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-database-unavailable'
  location: 'global'
  tags: tags
  properties: {
    description: 'PostgreSQL is not accepting connections.'
    severity: 0
    enabled: true
    scopes: [pgServerId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'alive'
          metricName: 'is_db_alive'
          metricNamespace: 'Microsoft.DBforPostgreSQL/flexibleServers'
          operator: 'LessThan'
          threshold: 1
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroupId }]
  }
}

resource clamavDown 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-clamav-unavailable'
  location: 'global'
  tags: tags
  properties: {
    description: 'The malware scanner has no running replica; document uploads are failing closed.'
    severity: 1
    enabled: true
    scopes: [clamavAppId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'replicas'
          metricName: 'Replicas'
          metricNamespace: 'Microsoft.App/containerApps'
          operator: 'LessThan'
          threshold: 1
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroupId }]
  }
}

resource appDown 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-app-no-replicas'
  location: 'global'
  tags: tags
  properties: {
    description: 'The application has no running replica.'
    severity: 0
    enabled: true
    scopes: [appId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'replicas'
          metricName: 'Replicas'
          metricNamespace: 'Microsoft.App/containerApps'
          operator: 'LessThan'
          threshold: 1
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroupId }]
  }
}
