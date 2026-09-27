// Temporary probe. HTTPS-only is disabled so Checkov must fail.
// This file is not a merge candidate.

resource probe 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'nzilasarifprobe'
  location: resourceGroup().location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: false
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_0'
  }
}
