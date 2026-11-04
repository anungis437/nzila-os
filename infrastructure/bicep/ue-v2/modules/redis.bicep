// Azure Managed Redis (rate limiting is a required runtime dependency, failing closed when absent).
// REDIS_URL for the app is rediss://:<access key>@<host>:10000 and is stored in Key Vault by the
// runbook; this template never emits keys. EnterpriseCluster policy is required by the
// non-cluster ioredis client the rate limiter uses.
param name string
param location string
param skuName string = 'Balanced_B1'
@description('High availability (replica). Disabled is a dev/test option that roughly halves the cost.')
param highAvailability bool = true
param peSubnetId string
param redisDnsZoneId string
param tags object = {}

resource cluster 'Microsoft.Cache/redisEnterprise@2025-07-01' = {
  name: name
  location: location
  tags: tags
  sku: { name: skuName }
  // highAvailability is only written when disabled, so the production resource body is unchanged.
  properties: union({
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
  }, highAvailability ? {} : { highAvailability: 'Disabled' })
}

resource database 'Microsoft.Cache/redisEnterprise/databases@2025-07-01' = {
  parent: cluster
  name: 'default'
  properties: {
    clientProtocol: 'Encrypted'
    port: 10000
    clusteringPolicy: 'EnterpriseCluster'
    evictionPolicy: 'VolatileLRU'
    accessKeysAuthentication: 'Enabled'
  }
}

module pe 'private-endpoint.bicep' = {
  name: '${name}-pe'
  params: {
    name: '${name}-pe'
    location: location
    subnetId: peSubnetId
    targetResourceId: cluster.id
    groupId: 'redisEnterprise'
    dnsZoneId: redisDnsZoneId
    tags: tags
  }
  dependsOn: [database]
}

output hostName string = cluster.properties.hostName
