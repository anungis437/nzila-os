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
param entraClientId string = ''
param entraTenantId string = ''
param minReplicas int = 2
param maxReplicas int = 6
param clamavMinReplicas int = 1
param clamavMaxReplicas int = 2
@allowed(['Single', 'Multiple'])
param appRevisionMode string = 'Single'
param appPinnedRevisionName string = ''
param appRevisionSuffix string = ''
@description('Optional ingress IP allow-list for the app (CIDR strings). Empty = no restriction.')
param ingressAllowedIpRanges array = []
param prefix string
@description('Server runtime profile. Qualification exercised the server under "internal"; the owner decides before go-live.')
@allowed(['internal', 'executive'])
param featureProfile string = 'internal'
@description('Stripe is optional at initial launch (client-commercial billing is post-launch). Enable only after the production Stripe secrets exist in Key Vault.')
param enableStripe bool = false
param tags object = {}

var stagingConnectionBudget = loadJsonContent('../staging-connection-budget.json')
var runtimePoolLimits = deploymentEnvironment == 'prod' ? {
  DB_POOL_MAX: 10
  DATABASE_POOL_SIZE: 20
  SYSTEM_DB_POOL_MAX: 5
  AUTH_DB_POOL_MAX: 5
  AUTH_SYSTEM_DB_POOL_MAX: 5
} : stagingConnectionBudget.poolCaps

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
var stagingAuthSystemSecretNames = deploymentEnvironment == 'staging' ? ['auth-system-database-url', 'nar-signing-secret'] : []
var authSystemEnvironment = deploymentEnvironment == 'staging' ? [
  { name: 'AUTH_SYSTEM_DATABASE_URL', secretRef: 'auth-system-database-url' }
] : [
  { name: 'AUTH_SYSTEM_DATABASE_URL', secretRef: 'auth-database-url' }
]
var stagingEnvironment = deploymentEnvironment == 'staging' ? [
  { name: 'TARGET_ENVIRONMENT', value: 'staging' }
  { name: 'UE_APP_URL', value: appUrl }
  { name: 'UE_MARKETING_URL', value: effectiveSiteUrl }
  { name: 'UE_FRONTEND_IMAGE_DIGEST', value: last(split(appImage, '@')) }
  { name: 'NAR_SIGNING_SECRET', secretRef: 'nar-signing-secret' }
  { name: 'NAR_SIGNING_KEY_ID', value: 'ue-v2-staging-nar-v1' }
  { name: 'READY_REQUIRE_DECISION_PROOF', value: 'true' }
] : []
var stripeSecretNames = enableStripe ? ['stripe-secret-key', 'stripe-webhook-secret'] : []
var entraConfigured = !empty(entraClientId) && !empty(entraTenantId)
var entraSecretNames = entraConfigured ? ['azure-ad-client-secret'] : []
var entraEnv = entraConfigured ? concat([
  { name: 'AZURE_AD_CLIENT_ID', value: entraClientId }
  { name: 'AZURE_AD_TENANT_ID', value: entraTenantId }
  { name: 'AZURE_AD_CLIENT_SECRET', secretRef: 'azure-ad-client-secret' }
], deploymentEnvironment == 'staging' ? [
  { name: 'AZURE_AD_STAGING_SINGLE_TENANT', value: 'true' }
  { name: 'AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS', value: '900' }
] : []) : []
var secrets = [for n in concat(secretNames, stagingAuthSystemSecretNames, stripeSecretNames, entraSecretNames): {
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
var appTraffic = empty(appPinnedRevisionName) ? [{ latestRevision: true, weight: 100 }] : [{ revisionName: appPinnedRevisionName, weight: 100 }]
var appIngress = union({ external: true, targetPort: 3000, transport: 'auto', allowInsecure: false, traffic: appTraffic }, empty(ingressAllowedIpRanges) ? {} : { ipSecurityRestrictions: ipRestrictions })
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
          probes: [
            {
              // The scanner's own clamd daemon can be reachable-but-unready (e.g. loading signatures, or
              // its process not actually up despite the HTTP wrapper responding); this hits the wrapper's
              // real clamd PING round-trip so Container Apps only routes scan requests to a replica that
              // can actually reach clamd, instead of one whose HTTP server is merely listening.
              type: 'Readiness'
              httpGet: { path: '/health', port: 8080 }
              initialDelaySeconds: 15
              periodSeconds: 15
            }
          ]
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
      activeRevisionsMode: appRevisionMode
      ingress: appIngress
      registries: [{ server: acrLoginServer, identity: identityId }]
      secrets: secrets
    }
    template: {
      revisionSuffix: empty(appRevisionSuffix) ? null : appRevisionSuffix
      containers: [
        {
          name: 'union-eyes'
          image: appImage
          resources: { cpu: json('1'), memory: '2Gi' }
          probes: [
            {
              type: 'Liveness'
              // Staging restarts only an unresponsive process, not a slow dependency census.
              httpGet: { path: deploymentEnvironment == 'staging' ? '/api/health/liveness' : '/api/health', port: 3000 }
              initialDelaySeconds: 20
              periodSeconds: 20
              timeoutSeconds: deploymentEnvironment == 'staging' ? 5 : 1
            }
            {
              type: 'Readiness'
              // Readiness must fail closed when the database, identity or required services are unavailable.
              // Catalog, signing and service checks control traffic admission, not process restarts.
              httpGet: { path: '/api/ready', port: 3000 }
              initialDelaySeconds: 10
              periodSeconds: 10
              timeoutSeconds: deploymentEnvironment == 'staging' ? 10 : 1
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
            // At most two revisions x two replicas during rollout. Seven distinct
            // pools per process x one connection = 28, leaving seven ordinary
            // slots on staging's 50-connection server after 15 reserved slots.
            { name: 'DB_POOL_MAX', value: string(runtimePoolLimits.DB_POOL_MAX) }
            { name: 'DATABASE_POOL_SIZE', value: string(runtimePoolLimits.DATABASE_POOL_SIZE) }
            { name: 'SYSTEM_DB_POOL_MAX', value: string(runtimePoolLimits.SYSTEM_DB_POOL_MAX) }
            { name: 'AUTH_DB_POOL_MAX', value: string(runtimePoolLimits.AUTH_DB_POOL_MAX) }
            { name: 'AUTH_SYSTEM_DB_POOL_MAX', value: string(runtimePoolLimits.AUTH_SYSTEM_DB_POOL_MAX) }
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
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'AUTH_MFA_ENCRYPTION_KEY', secretRef: 'mfa-encryption-key' }
            { name: 'VOTING_SECRET', secretRef: 'voting-secret' }
            { name: 'CRON_SECRET_KEY', secretRef: 'cron-secret' }
            { name: 'REDIS_URL', secretRef: 'redis-url' }
            { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
            { name: 'AZURE_STORAGE_ACCOUNT_KEY', secretRef: 'storage-account-key' }
          ], stripeEnv, entraEnv, authSystemEnvironment, stagingEnvironment)
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
  // Keep existing names when they fit. A legacy suffix must also budget the prefix against the 32-character limit.
  name: contains(job, 'legacyJobSuffix') ? '${take(prefix, 32 - length(job.legacyJobSuffix) - 1)}-${job.legacyJobSuffix}' : '${take(prefix, 18)}-${job.code}'
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
