// ──────────────────────────────────────────────────────────────────────────────
// Key Vault secret writer
//
// Writes a single secret to an existing Key Vault with a content type and an
// expiration date. Kept as a dedicated module so the secret resource is
// unconditional (callers gate creation via a conditional module invocation),
// which keeps IaC scanners able to verify CKV_AZURE_41 (expiration) and
// CKV_AZURE_114 (content type).
// ──────────────────────────────────────────────────────────────────────────────

@description('Name of the existing Key Vault to write the secret into.')
param keyVaultName string

@description('Secret name (without the vault prefix).')
param secretName string

@secure()
@description('Secret value.')
param secretValue string

@description('Secret content type.')
param contentType string = 'text/plain'

@description('Secret expiration as Unix epoch seconds.')
param expiryEpoch int

resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVaultName}/${secretName}'
  properties: {
    value: secretValue
    contentType: contentType
    attributes: {
      enabled: true
      exp: expiryEpoch
    }
  }
}

output secretUri string = secret.properties.secretUri
