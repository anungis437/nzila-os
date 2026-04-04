// ──────────────────────────────────────────────────────────────────────────────
// W1-1: Container Apps Environment with mTLS
// Enforces mutual TLS between all container apps in the environment.
//
// Scaling: HTTP concurrency + CPU utilization triggers.
// Resources: Parameterized CPU/memory for incremental scale-up.
// ──────────────────────────────────────────────────────────────────────────────

param envName string
param location string
param logAnalyticsId string
@secure()
param logAnalyticsKey string
param enableMtls bool = true
param minReplicas int = 1
param maxReplicas int = 5

@description('CPU cores per container (e.g., "0.5", "1.0", "2.0", "4.0")')
param containerCpu string = '0.5'

@description('Memory per container (e.g., "1Gi", "2Gi", "4Gi", "8Gi")')
param containerMemory string = '1Gi'

@description('HTTP concurrent requests per replica before scale-out')
param httpConcurrency string = '50'

@description('CPU utilization % threshold for scale-out (0 = disabled)')
param cpuScaleThreshold int = 70

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsId
        sharedKey: logAnalyticsKey
      }
    }
    peerAuthentication: {
      mtls: {
        enabled: enableMtls  // W1-1: enforce mTLS between all services
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ── App template (parameterized per service) ──────────────────────────────

@description('Container app definitions for each Nzila service')
param apps array = [
  { name: 'nzila-os-web', image: 'nzila/web', port: 3000 }
  { name: 'nzila-os-console', image: 'nzila/console', port: 3001 }
  { name: 'nzila-os-partners', image: 'nzila/partners', port: 3002 }
  { name: 'nzila-os-union-eyes', image: 'nzila/union-eyes', port: 3003 }
]

resource containerApps 'Microsoft.App/containerApps@2024-03-01' = [
  for app in apps: {
    name: app.name
    location: location
    properties: {
      managedEnvironmentId: containerEnv.id
      configuration: {
        ingress: {
          external: true
          targetPort: app.port
          transport: 'http'
          clientCertificateMode: enableMtls ? 'require' : 'ignore'
        }
        registries: []
      }
      template: {
        containers: [
          {
            name: app.name
            image: '${app.image}:latest'
            resources: {
              cpu: json(containerCpu)
              memory: containerMemory
            }
            probes: [
              {
                type: 'Liveness'
                httpGet: {
                  path: '/api/health'
                  port: app.port
                }
                periodSeconds: 30
              }
              {
                type: 'Readiness'
                httpGet: {
                  path: '/api/ready'
                  port: app.port
                }
                periodSeconds: 10
              }
            ]
          }
        ]
        scale: {
          minReplicas: minReplicas
          maxReplicas: maxReplicas
          rules: concat([
            {
              name: 'http-scaling'
              http: {
                metadata: {
                  concurrentRequests: httpConcurrency
                }
              }
            }
          ], cpuScaleThreshold > 0 ? [
            {
              name: 'cpu-scaling'
              custom: {
                type: 'cpu'
                metadata: {
                  type: 'Utilization'
                  value: string(cpuScaleThreshold)
                }
              }
            }
          ] : [])
        }
      }
    }
  }
]

output environmentId string = containerEnv.id
