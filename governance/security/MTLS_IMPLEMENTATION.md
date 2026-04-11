# mTLS Between Services — Implementation Guide

**Document ID:** SEC-MTLS-2026-001  
**Version:** 1.0  
**Classification:** INTERNAL  
**Created:** 2026-03-04  
**Owner:** Platform Engineering  
**Status:** PLANNED  
**Threat Model Reference:** S-03 (Service-to-service spoofing)

---

## 1. Current State

- Request ID propagation exists (`x-request-id`, `x-trace-id`, `x-org-id` headers)
- No mutual TLS between services — communication relies on Azure VNet isolation
- Entra ID OIDC provides user authentication but not service-to-service authentication

## 2. Target Architecture

Azure Container Apps natively supports mTLS for service-to-service communication 
within an environment. This is the recommended approach for Nzila OS.

### Services Requiring mTLS

| Service | Container App | Communication Pattern |
|---------|---------------|----------------------|
| Console | `nzila-console` | ↔ orchestrator-api, ↔ DB |
| Partners | `nzila-partners` | ↔ orchestrator-api, ↔ DB |
| Orchestrator API | `nzila-orchestrator` | ↔ all apps, ↔ DB, ↔ external APIs |
| Union Eyes | `nzila-union-eyes` | ↔ orchestrator-api, ↔ DB |
| Web | `nzila-web` | ↔ orchestrator-api (read-only) |

## 3. Azure Container Apps mTLS Configuration

### 3.1 Enable Environment-Level mTLS

```bicep
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'nzila-${environment}'
  location: location
  properties: {
    peerTrafficConfiguration: {
      encryption: {
        enabled: true  // Enables mTLS for all inter-service traffic
      }
    }
    vnetConfiguration: {
      internal: true  // Internal VNet — no public ingress to services
      infrastructureSubnetId: vnetSubnetId
    }
  }
}
```

### 3.2 Per-App Ingress Configuration

```bicep
resource consoleApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'nzila-console'
  properties: {
    configuration: {
      ingress: {
        external: true  // Only for user-facing apps
        targetPort: 3000
        transport: 'http2'  // Required for mTLS
        clientCertificateMode: 'require'  // Enforce client certs
      }
    }
  }
}

resource orchestratorApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'nzila-orchestrator'
  properties: {
    configuration: {
      ingress: {
        external: false  // Internal only — not exposed to internet
        targetPort: 8080
        transport: 'http2'
        clientCertificateMode: 'require'
      }
    }
  }
}
```

### 3.3 Azure CLI Enablement

```bash
# Enable mTLS for the Container Apps environment
az containerapp env update \
  --name nzila-${ENVIRONMENT} \
  --resource-group nzila-rg-${ENVIRONMENT} \
  --peer-traffic-encryption true

# Verify mTLS is enabled
az containerapp env show \
  --name nzila-${ENVIRONMENT} \
  --resource-group nzila-rg-${ENVIRONMENT} \
  --query "properties.peerTrafficConfiguration.encryption.enabled"
```

## 4. Application-Level Changes

### 4.1 Service Client Configuration (os-core)

The `contextToHeaders()` function in `packages/os-core/src/telemetry/requestContext.ts` 
already propagates identity headers. With mTLS enabled, these headers are authenticated 
at the transport layer.

No application code changes required — mTLS is transparent to the application.

### 4.2 Certificate Validation Logging

Add to each service's health check to verify mTLS state:

```typescript
// In app/api/health/route.ts — add mTLS status check
const mtlsEnabled = process.env.CONTAINER_APP_ENV_MTLS === 'true' ||
  request.headers.get('x-forwarded-client-cert') !== null

// Include in health response
checks: {
  db: { status: dbOk ? 'ok' : 'fail' },
  mtls: { status: mtlsEnabled ? 'ok' : 'not-configured' },
}
```

## 5. Rollout Plan

| Phase | Action | Timeline |
|-------|--------|----------|
| 1 | Enable mTLS in dev environment | Week 1 |
| 2 | Validate health checks report mTLS status | Week 1 |
| 3 | Enable in staging with smoke tests | Week 2 |
| 4 | Enable in production during maintenance window | Week 3 |
| 5 | Update threat model S-03 to ✅ Mitigated | Week 3 |

## 6. Verification

After enablement, verify with:

```bash
# Check certificate is presented in inter-service calls
az containerapp exec \
  --name nzila-orchestrator \
  --resource-group nzila-rg-prod \
  --command "curl -v https://nzila-console.internal 2>&1 | grep 'SSL certificate'"

# Run contract tests
pnpm contract-tests
```

## 7. Evidence Artifacts

- Bicep templates stored in `platform/bicep/`
- Deployment logs retained in Azure Monitor
- mTLS verification results exported to evidence packs under control family `infrastructure`
