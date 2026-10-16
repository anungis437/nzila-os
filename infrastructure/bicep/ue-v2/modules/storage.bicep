// Document storage for Union Eyes V2.
// NOTE: @nzila/blob signs SAS URLs with the storage account KEY and has no managed-identity path,
// so shared-key access must stay enabled for this launch. Compensating controls: the account is
// reachable only through its private endpoint, the key lives only in Key Vault, and rotation is a
// runbook step. Managed-identity (user-delegation SAS) support is a post-launch hardening item.
param name string
param location string
param containerName string
param peSubnetId string
param blobDnsZoneId string
param logAnalyticsId string
param tags object = {}

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_GZRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'None' }
    encryption: {
      requireInfrastructureEncryption: true
      services: { blob: { enabled: true } }
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: 30 }
    containerDeleteRetentionPolicy: { enabled: true, days: 30 }
    changeFeed: { enabled: true, retentionInDays: 90 }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: { publicAccess: 'None' }
}

resource lifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'tier-and-expire-versions'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: { blobTypes: ['blockBlob'], prefixMatch: ['${containerName}/'] }
            actions: {
              baseBlob: { tierToCool: { daysAfterModificationGreaterThan: 90 } }
              version: { delete: { daysAfterCreationGreaterThan: 365 } }
            }
          }
        }
      ]
    }
  }
}

module pe 'private-endpoint.bicep' = {
  name: '${name}-blob-pe'
  params: {
    name: '${name}-blob-pe'
    location: location
    subnetId: peSubnetId
    targetResourceId: account.id
    groupId: 'blob'
    dnsZoneId: blobDnsZoneId
    tags: tags
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: blobService
  name: 'to-law'
  properties: {
    workspaceId: logAnalyticsId
    logs: [
      { category: 'StorageRead', enabled: true }
      { category: 'StorageWrite', enabled: true }
      { category: 'StorageDelete', enabled: true }
    ]
  }
}

output accountId string = account.id
output accountName string = account.name
