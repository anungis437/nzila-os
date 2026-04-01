// ──────────────────────────────────────────────────────────────────────────────
// Azure Container Registry
// ──────────────────────────────────────────────────────────────────────────────

param name string
param location string

@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Basic'

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: name
  location: location
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false  // Use managed identity, not admin credentials
    policies: {
      quarantinePolicy: {
        status: sku == 'Premium' ? 'enabled' : 'disabled'
      }
      retentionPolicy: {
        days: sku == 'Premium' ? 30 : 7
        status: 'enabled'
      }
    }
  }
}

output loginServer string = acr.properties.loginServer
output acrId string = acr.id
