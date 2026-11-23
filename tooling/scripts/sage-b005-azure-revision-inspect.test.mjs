import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  composeAzureRevisionReceipt,
  inspectAzureRevision,
  runAzureRevisionInspect,
  FORBIDDEN_PROD_RESOURCE_GROUPS,
  DEFAULT_RESOURCE_GROUP,
  DEFAULT_APP_NAME,
} from './sage-b005-azure-revision-inspect.mjs'

describe('SAGE B-005 Azure revision inspect', () => {
  it('never elevates b005Closure even with full control-plane capture', () => {
    const receipt = composeAzureRevisionReceipt({
      resourceGroup: DEFAULT_RESOURCE_GROUP,
      appName: DEFAULT_APP_NAME,
      healthUrl: 'https://staging-admin.nzilaventures.com/api/health',
      az: { present: true, version: '2.93.0', error: null },
      account: {
        authenticated: true,
        account: { name: 'Nzila', id: 'sub-1', tenantId: 't-1', user: 'ops' },
        error: null,
      },
      containerApp: {
        show: {
          fqdn: 'nzila-os-platform-admin.example.azurecontainerapps.io',
          image: 'nzilaos.azurecr.io/platform-admin@sha256:' + 'a'.repeat(64),
          latestRevisionName: 'nzila-os-platform-admin--00042',
          targetPort: 3000,
          provisioningState: 'Succeeded',
        },
        revisions: [
          {
            name: 'nzila-os-platform-admin--00042',
            active: true,
            trafficWeight: 100,
            createdTime: '2026-11-23T00:00:00Z',
            fqdn: 'nzila-os-platform-admin--00042.example.azurecontainerapps.io',
          },
        ],
      },
      health: {
        reachable: true,
        httpStatus: 200,
        commit: 'a'.repeat(40),
        status: 'ok',
        error: null,
      },
    })
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
    assert.equal(receipt.result, 'CONTROL_PLANE_CAPTURED')
    assert.equal(receipt.kind, 'SAGE_B005_AZURE_REVISION_INSPECT')
    assert.equal(receipt.containerApp.latestRevisionName, 'nzila-os-platform-admin--00042')
  })

  it('refuses production resource groups', async () => {
    await assert.rejects(
      () =>
        inspectAzureRevision({
          resourceGroup: FORBIDDEN_PROD_RESOURCE_GROUPS[0],
          execAz: () => {
            throw new Error('should not run')
          },
        }),
      /PROD_RESOURCE_GROUP_REFUSED/,
    )
  })

  it('records AUTH_REQUIRED when az is present but not logged in', async () => {
    const execAz = (args) => {
      if (args[0] === 'version') {
        return JSON.stringify({ 'azure-cli': '2.93.0' })
      }
      if (args[0] === 'account') {
        const err = new Error('Please run az login')
        err.stderr = 'Please run \'az login\' to setup account.'
        throw err
      }
      throw new Error('unexpected: ' + args.join(' '))
    }
    const fetchImpl = async () => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    }
    const receipt = await inspectAzureRevision({ execAz, fetchImpl })
    assert.equal(receipt.result, 'AUTH_REQUIRED')
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
    assert.equal(receipt.az.present, true)
    assert.equal(receipt.az.version, '2.93.0')
    assert.equal(receipt.accountError, 'AZ_LOGIN_REQUIRED')
    assert.equal(receipt.health.error, 'HEALTH_TIMEOUT')
    assert.ok(receipt.azurePluginSources.some((s) => s.tool === 'extension_cli_install'))
  })

  it('captures container app show + revisions when authenticated', async () => {
    const execAz = (args) => {
      if (args[0] === 'version') return JSON.stringify({ 'azure-cli': '2.93.0' })
      if (args[0] === 'account') {
        return JSON.stringify({
          name: 'Nzila',
          id: '11111111-1111-1111-1111-111111111111',
          tenantId: '22222222-2222-2222-2222-222222222222',
          user: 'ops@example.com',
        })
      }
      if (args[0] === 'containerapp' && args[1] === 'show') {
        return JSON.stringify({
          fqdn: 'app.happyhill.canadacentral.azurecontainerapps.io',
          image: 'nzilaos.azurecr.io/platform-admin:staging',
          latestRevisionName: 'nzila-os-platform-admin--0007',
          targetPort: 3000,
          provisioningState: 'Succeeded',
        })
      }
      if (args[0] === 'containerapp' && args[1] === 'revision') {
        return JSON.stringify([
          {
            name: 'nzila-os-platform-admin--0007',
            active: true,
            trafficWeight: 100,
            createdTime: '2026-11-20T12:00:00Z',
            fqdn: 'app---0007.happyhill.canadacentral.azurecontainerapps.io',
          },
        ])
      }
      throw new Error('unexpected: ' + args.join(' '))
    }
    const fetchImpl = async () => ({
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        status: 'ok',
        buildInfo: { commit: 'b'.repeat(40) },
      }),
    })
    const dir = await mkdtemp(join(tmpdir(), 'sage-b005-az-'))
    const out = join(dir, 'azure-revision.json')
    try {
      const receipt = await runAzureRevisionInspect(
        ['--out', out, '--resource-group', DEFAULT_RESOURCE_GROUP],
        { execAz, fetchImpl },
      )
      assert.equal(receipt.result, 'CONTROL_PLANE_CAPTURED')
      assert.equal(receipt.b005Closure, 'NOT_PROVEN')
      assert.equal(receipt.containerApp.image, 'nzilaos.azurecr.io/platform-admin:staging')
      assert.equal(receipt.health.commit, 'b'.repeat(40))
      const disk = JSON.parse(await readFile(out, 'utf8'))
      assert.equal(disk.kind, 'SAGE_B005_AZURE_REVISION_INSPECT')
      assert.equal(disk.b005Closure, 'NOT_PROVEN')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
