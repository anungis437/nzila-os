// Nzila Platform — Azure Storage Account with evidence lifecycle policies
//
// Deploys a StorageV2 account with four lifecycle management rules
// matching the retention classes defined in ops/compliance/Evidence-Storage-Convention.md:
//
//   PERMANENT   — no auto-delete; cool after 365 days
//   7_YEARS     — cool after 180 days, archive after 365 days, delete after 2555 days
//   3_YEARS     — cool after 90 days, archive after 365 days, delete after 1095 days
//   1_YEAR      — cool after 90 days, delete after 365 days

targetScope = 'resourceGroup'

@description('Storage account name (3-24 chars, lowercase alphanumeric)')
@minLength(3)
@maxLength(24)
param name string

@description('Azure region')
param location string

@description('SKU name')
@allowed(['Standard_LRS', 'Standard_GRS', 'Standard_RAGRS'])
param skuName string = 'Standard_RAGRS'

@description('Enable blob versioning for tamper evidence')
param enableVersioning bool = true

@description('Enable blob soft delete (days)')
param softDeleteRetentionDays int = 30

@description('Tags for the resource')
param tags object = {}

// ── Storage Account ───────────────────────────────────────────────────────

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  sku: { name: skuName }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ── Blob Services (versioning + soft delete) ──────────────────────────────

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    isVersioningEnabled: enableVersioning
    deleteRetentionPolicy: {
      enabled: true
      days: softDeleteRetentionDays
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: softDeleteRetentionDays
    }
  }
}

// ── Containers ────────────────────────────────────────────────────────────

resource minutebookContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'minutebook'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Corporate records — resolutions, certificates, minutes'
      retentionClass: 'PERMANENT'
    }
  }
}

resource evidenceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'evidence'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Control test and compliance evidence packs'
      retentionClass: 'MIXED'
    }
  }
}

resource exportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'exports'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Investor/auditor data-room exports'
      retentionClass: '1_YEAR'
    }
  }
}

// ── Lifecycle Management Rules ────────────────────────────────────────────
//
// Blobs are tagged with "retention-class" to route them to the correct
// lifecycle policy. Tags are set at upload time by the evidence automation.

resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        // ── PERMANENT: never delete, move to cool after 365 d ──────────
        {
          name: 'permanent-to-cool'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              blobIndexMatch: [
                {
                  name: 'retention-class'
                  op: '=='
                  value: 'PERMANENT'
                }
              ]
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 365
                }
              }
            }
          }
        }

        // ── 7_YEARS: cool@180d, archive@365d, delete@2555d ─────────────
        {
          name: 'seven-years-lifecycle'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              blobIndexMatch: [
                {
                  name: 'retention-class'
                  op: '=='
                  value: '7_YEARS'
                }
              ]
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 180
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 365
                }
                delete: {
                  daysAfterModificationGreaterThan: 2555
                }
              }
            }
          }
        }

        // ── 3_YEARS: cool@90d, archive@365d, delete@1095d ──────────────
        {
          name: 'three-years-lifecycle'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              blobIndexMatch: [
                {
                  name: 'retention-class'
                  op: '=='
                  value: '3_YEARS'
                }
              ]
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 90
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 365
                }
                delete: {
                  daysAfterModificationGreaterThan: 1095
                }
              }
            }
          }
        }

        // ── 1_YEAR: cool@90d, delete@365d ──────────────────────────────
        {
          name: 'one-year-lifecycle'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              blobIndexMatch: [
                {
                  name: 'retention-class'
                  op: '=='
                  value: '1_YEAR'
                }
              ]
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 90
                }
                delete: {
                  daysAfterModificationGreaterThan: 365
                }
              }
            }
          }
        }

        // ── Cleanup: delete old versions and snapshots ─────────────────
        {
          name: 'cleanup-old-versions'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
            }
            actions: {
              version: {
                delete: {
                  daysAfterCreationGreaterThan: 2555
                }
              }
              snapshot: {
                delete: {
                  daysAfterCreationGreaterThan: 2555
                }
              }
            }
          }
        }
      ]
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────

@description('Storage account resource ID')
output id string = storageAccount.id

@description('Storage account name')
output storageAccountName string = storageAccount.name

@description('Primary blob endpoint')
output primaryBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob

@description('Primary access key (use Key Vault in production)')
output primaryAccessKey string = storageAccount.listKeys().keys[0].value
