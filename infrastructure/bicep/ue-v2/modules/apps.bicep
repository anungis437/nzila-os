@allowed(['staging', 'prod'])
param deploymentEnvironment string
param location string
param environmentId string
param environmentDefaultDomain string
param identityId string
param identityClientId string
param acrLoginServer string
param appImage string
param clamavImage string
param cronImage string
param keyVaultUri string
param storageAccountName string
param documentsContainerName string
@description('Custom host name. Empty = the app\'s Container Apps default FQDN.')
param publicHostName string
@description('Marketing/site URL. Empty = the app URL.')
param siteUrl string
param emailFrom string
param emailReplyTo string
param minReplicas int = 2
param maxReplicas int = 6
param clamavMinReplicas int = 1
param clamavMaxReplicas int = 2
@description('Optional ingress IP allow-list for the app (CIDR strings). Empty = no restriction.')
param ingressAllowedIpRanges array = []
param prefix string
@description('Server runtime profile. Qualification exercised the server under "internal"; the owner decides before go-live.')
@allowed(['internal', 'executive'])
param featureProfile string = 'internal'
@description('Stripe is optional at initial launch (client-commercial billing is post-launch). Enable only after the production Stripe secrets exist in Key Vault.')
param enableStripe bool = false
param tags object = {}

var kvBase = endsWith(keyVaultUri, '/') ? keyVaultUri : '${keyVaultUri}/'
// Secret names are Key Vault secret names; values are resolved at revision start by the identity.
var secretNames = [
  'database-url'
  'system-database-url'
  'auth-database-url'
  'auth-secret'
  'mfa-encryption-key'
  'voting-secret'
  'cron-secret'
  'redis-url'
  'resend-api-key'
  'storage-account-key'
]
var stripeSecretNames = enableStripe ? ['stripe-secret-key', 'stripe-webhook-secret'] : []
var secrets = [for n in concat(secretNames, stripeSecretNames): {
  name: n
  keyVaultUrl: '${kvBase}secrets/${n}'
  identity: identityId
}]

var stripeEnv = enableStripe ? [
  { name: 'STRIPE_SECRET_KEY', secretRef: 'stripe-secret-key' }
  { name: 'STRIPE_WEBHOOK_SECRET', secretRef: 'stripe-webhook-secret' }
] : []
var appHost = empty(publicHostName) ? '${prefix}-app.${environmentDefaultDomain}' : publicHostName
var appUrl = 'https://${appHost}'
var effectiveSiteUrl = empty(siteUrl) ? appUrl : siteUrl
var ipRestrictions = [
  for (cidr, i) in ingressAllowedIpRanges: {
    name: 'allow-${i}'
    ipAddressRange: cidr
    action: 'Allow'
  }
]
// ipSecurityRestrictions is only written when an allow-list is given, so production ingress is unchanged.
var appIngress = union({ external: true, targetPort: 3000, transport: 'auto', allowInsecure: false }, empty(ingressAllowedIpRanges) ? {} : { ipSecurityRestrictions: ipRestrictions })
var clamavUrl = 'https://${prefix}-clamav.internal.${environmentDefaultDomain}'

resource clamav 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-clamav'
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: false, targetPort: 8080, transport: 'auto' }
      registries: [{ server: acrLoginServer, identity: identityId }]
    }
    template: {
      containers: [
        {
          name: 'clamav'
          image: clamavImage
          resources: { cpu: json('1.75'), memory: '3.5Gi' }
        }
      ]
      // The scanner is a launch dependency: production never scales it to zero, and uploads fail
      // closed without it. A cost-sized staging may scale it to zero (cold start fails uploads closed).
      scale: { minReplicas: clamavMinReplicas, maxReplicas: clamavMaxReplicas }
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-app'
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: appIngress
      registries: [{ server: acrLoginServer, identity: identityId }]
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: 'union-eyes'
          image: appImage
          resources: { cpu: json('1'), memory: '2Gi' }
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 3000 }
              initialDelaySeconds: 20
              periodSeconds: 20
            }
            {
              type: 'Readiness'
              // Readiness must fail closed when the database, identity or required services are unavailable.
              // Liveness remains /api/health so a temporary dependency outage does not cause restart loops.
              httpGet: { path: '/api/ready', port: 3000 }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'AZURE_CLIENT_ID', value: identityClientId }
            { name: 'UE_CANONICAL_BOOTSTRAP_V2', value: '1' }
            { name: 'UE_ENVIRONMENT', value: deploymentEnvironment == 'prod' ? 'production' : 'staging' }
            { name: 'UE_DEPLOYMENT_TYPE', value: deploymentEnvironment }
            { name: 'UE_FEATURE_PROFILE', value: featureProfile }
            { name: 'NEXT_PUBLIC_APP_ENV', value: deploymentEnvironment == 'prod' ? 'production' : 'staging' }
            { name: 'NEXT_PUBLIC_APP_URL', value: appUrl }
            { name: 'NEXT_PUBLIC_SITE_URL', value: effectiveSiteUrl }
            { name: 'AUTH_URL', value: appUrl }
            { name: 'AUTH_TRUST_HOST', value: 'true' }
            { name: 'DB_POOL_MAX', value: '10' }
            { name: 'AZURE_KEY_VAULT_URL', value: keyVaultUri }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccountName }
            { name: 'AZURE_BLOB_CONTAINER', value: documentsContainerName }
            { name: 'CLAMAV_URL', value: clamavUrl }
            { name: 'CLAMAV_FAIL_OPEN', value: 'false' }
            { name: 'EMAIL_PROVIDER', value: 'resend' }
            { name: 'RESEND_FROM_EMAIL', value: emailFrom }
            { name: 'EMAIL_FROM', value: emailFrom }
            { name: 'EMAIL_REPLY_TO', value: emailReplyTo }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'SYSTEM_DATABASE_URL', secretRef: 'system-database-url' }
            { name: 'AUTH_DATABASE_URL', secretRef: 'auth-database-url' }
            { name: 'AUTH_SYSTEM_DATABASE_URL', secretRef: 'auth-database-url' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'AUTH_MFA_ENCRYPTION_KEY', secretRef: 'mfa-encryption-key' }
            { name: 'VOTING_SECRET', secretRef: 'voting-secret' }
            { name: 'CRON_SECRET_KEY', secretRef: 'cron-secret' }
            { name: 'REDIS_URL', secretRef: 'redis-url' }
            { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
            { name: 'AZURE_STORAGE_ACCOUNT_KEY', secretRef: 'storage-account-key' }
          ], stripeEnv)
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '50' } } }
        ]
      }
    }
  }
  dependsOn: [clamav]
}

// Scheduled jobs: one Container Apps schedule job per entry of the manifest (apps/union-eyes/lib/operations/scheduled-jobs.json).
// Every job POSTs its route with the shared cron secret; `curl -f` makes a non-2xx answer fail the job run, so a job that failed
// is visible as a failed execution instead of a silent success. The manifest is the only place a schedule is declared.
var scheduledJobs = loadJsonContent('../../../../apps/union-eyes/lib/operations/scheduled-jobs.json').jobs

resource cronJobs 'Microsoft.App/jobs@2024-03-01' = [for job in scheduledJobs: {
  // Job names are limited to 32 characters, so the environment prefix is truncated. The deadline job keeps its original name.
  name: contains(job, 'legacyJobSuffix') ? '${prefix}-${job.legacyJobSuffix}' : '${take(prefix, 18)}-${job.code}'
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: job.timeoutSeconds + 20
      replicaRetryLimit: 1
      scheduleTriggerConfig: { cronExpression: job.schedule, parallelism: 1, replicaCompletionCount: 1 }
      registries: [{ server: acrLoginServer, identity: identityId }]
      secrets: [
        { name: 'cron-secret', keyVaultUrl: '${kvBase}secrets/cron-secret', identity: identityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'cron'
          image: cronImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          command: ['sh', '-c']
          args: ['curl -fsS -X POST --max-time ${job.timeoutSeconds} -H "x-cron-secret: $CRON_SECRET" "https://$APP_FQDN${job.path}"']
          env: [
            { name: 'APP_FQDN', value: app.properties.configuration.ingress.fqdn }
            { name: 'CRON_SECRET', secretRef: 'cron-secret' }
          ]
        }
      ]
    }
  }
}]
output appName string = app.name
output appId string = app.id
output appFqdn string = app.properties.configuration.ingress.fqdn
output clamavAppId string = clamav.id
