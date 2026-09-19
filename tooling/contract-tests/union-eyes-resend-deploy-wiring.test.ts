import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const workflow = readFileSync(resolve(root, '.github/workflows/deploy-union-eyes.yml'), 'utf8')

describe('UnionEyes production Resend deployment wiring', () => {
  it('fails closed unless both Resend secrets are available through Key Vault', () => {
    expect(workflow).toContain('ensure_required_kv_backed_secret "resend-api-key" "RESEND_API_KEY"')
    expect(workflow).toContain(
      'ensure_required_kv_backed_secret "resend-webhook-secret" "RESEND_WEBHOOK_SECRET"',
    )
    expect(workflow).toContain(
      '${SECRET_NAME}=keyvaultref:https://${KEY_VAULT_NAME}.vault.azure.net/secrets/${SECRET_NAME},identityref:system',
    )
  })

  it('enables the verified sender, reply path, and email readiness gate only in production', () => {
    const productionBlock = workflow.match(
      /if \[ "\$\{\{ needs\.plan\.outputs\.environment \}\}" = "production" \]; then([\s\S]*?)\n\s*fi/,
    )?.[1]

    expect(productionBlock).toBeDefined()
    expect(productionBlock).toContain('EMAIL_PROVIDER=resend')
    expect(productionBlock).toContain('RESEND_FROM_EMAIL=noreply@unioneyes.app')
    expect(productionBlock).toContain('EMAIL_FROM=noreply@unioneyes.app')
    expect(productionBlock).toContain('EMAIL_REPLY_TO=support@unioneyes.app')
    expect(productionBlock).toContain('READY_REQUIRE_EMAIL_DELIVERY=true')
  })
})
