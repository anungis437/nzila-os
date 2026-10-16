targetScope = 'subscription'

@description('Canada Central is the isolated synthetic builder primary region.')
param location string = 'canadacentral'

@description('Allows a read-only preview without package egress approval. Never set this to true for deployment.')
param previewOnly bool = true

@description('Exact Ubuntu APT source protocol/FQDN pairs, derived from the pinned Azure image.')
param approvedAptSources array = []

@description('Pinned Ubuntu 24.04 Azure Marketplace image version.')
param ubuntuImageVersion string = '24.04.202609040'

@description('Proof-only RSA SSH public key. Destroy its private key before deployment; no administrative ingress is authorized.')
@minLength(100)
param provisioningSshPublicKey string

@description('Commit containing the synthetic Go source.')
param sourceCommit string = '7bec20aad11d43eeae8099c14e021b3074154b27'

@description('SHA-256 of the deterministic tar archive generated from sourceCommit.')
param sourceArchiveSha256 string = 'DF81CAE6D23555FC43AD1D96EF38CBA0BA67FB06D551A5183168FF151AD2528E'

@description('Cost-attribution and synthetic-data classification tags.')
param tags object = {
  product: 'Nzila'
  environment: 'proof'
  service: 'G2-builder'
  owner: 'Nzila Platform'
  cost_center: 'NZ-20261008-INFRA-001'
  data_classification: 'synthetic-only'
}

var proofResourceGroupName = 'nzila-g2-proof-${uniqueString(subscription().id, 'NZ-20261008-INFRA-001')}'

resource proofResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: proofResourceGroupName
  location: location
  tags: tags
}

module builder './builder.bicep' = {
  name: 'nzilaG2SyntheticBuilder'
  scope: proofResourceGroup
  params: {
    location: location
    previewOnly: previewOnly
    approvedAptSources: approvedAptSources
    ubuntuImageVersion: ubuntuImageVersion
    provisioningSshPublicKey: provisioningSshPublicKey
    sourceCommit: sourceCommit
    sourceArchiveSha256: sourceArchiveSha256
    tags: tags
  }
}

output proofResourceGroupId string = proofResourceGroup.id
output registryName string = builder.outputs.registryName
output sourceCommit string = sourceCommit
output sourceArchiveSha256 string = sourceArchiveSha256
output bootstrapDisposition string = previewOnly || length(approvedAptSources) == 0 ? 'BOOTSTRAP_NOT_READY' : 'RUNTIME_PROOF_REQUIRED'
