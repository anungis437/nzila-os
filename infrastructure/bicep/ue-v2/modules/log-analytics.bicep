// Optional Log Analytics workspace for an environment that does not reuse an existing one.
// The template never modifies a reused workspace; a daily cap only applies to one created here.
param name string
param location string
@description('Daily ingestion cap in GB. -1 = no cap.')
param dailyCapGb int = -1
@minValue(30)
@maxValue(730)
param retentionDays int = 30
param tags object = {}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: retentionDays
    workspaceCapping: { dailyQuotaGb: dailyCapGb }
  }
}

output id string = workspace.id
