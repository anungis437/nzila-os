import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const manifest = (path: string) => JSON.parse(source(path)) as { dependencies?: Record<string, string> }

describe('Stripe 23.1.0 / Endive single-version contract', () => {
  it('converges every active direct SDK consumer and eliminates legacy resolutions', () => {
    for (const path of ['packages/payments-stripe/package.json', 'apps/union-eyes/package.json']) {
      expect(manifest(path).dependencies?.stripe, path).toBe('23.1.0')
    }
    for (const path of ['apps/trustcore/package.json', 'apps/union-eyes/services/financial-service/package.json']) {
      expect(manifest(path).dependencies?.stripe, path).toBeUndefined()
    }
    const lock = source('pnpm-lock.yaml')
    expect([...lock.matchAll(/^  stripe@[^\n]*:/gm)].map(m => m[0])).toEqual(['  stripe@23.1.0:'])
    expect(lock).toContain('sha512-fVUfMSfTPoukfoV//MUKAx2+YxyKmYaYtnAL9VkfnHfaPNQylFdWZMD+zgUFerI8rjbaiER8Vzj2XEUQ2AhAsQ==')
  })

  it('uses one API version and forbids alternate Stripe client factories', () => {
    expect(source('packages/payments-stripe/src/version.ts')).toContain("STRIPE_API_VERSION = '2026-10-28.endive'")
    expect(source('packages/payments-stripe/src/client.ts')).toContain('apiVersion: STRIPE_API_VERSION')
    expect(source('apps/trustcore/lib/stripe.ts')).toContain('createStripeClientForKey')
    expect(source('apps/trustcore/lib/stripe.ts')).not.toContain('new Stripe(')
  })

  it('removes unsupported Endive request fields and outdated invoice subscription access', () => {
    for (const path of [
      'apps/union-eyes/services/financial-service/src/services/payment-processing.ts',
      'apps/union-eyes/lib/services/payment-service.ts',
    ]) {
      expect(source(path), path).not.toMatch(/(^|\s)payment_method_types\s*:/m)
    }
    const p = source('packages/payments-stripe/src/primitives.ts')
    expect(p).toContain('latest_invoice.confirmation_secret')
    expect(p).not.toContain('latest_invoice.payment_intent')
    expect(source('apps/zonga/app/api/webhooks/stripe/route.ts')).toContain('invoice.parent?.subscription_details?.subscription')
  })
  it('pins the current Stripe Python Endive client in active billing and generated scaffolds', () => {
    for (const path of [
      'apps/union-eyes/backend/requirements.txt',
      'tech-repo-scaffold/django-backbone/requirements/base.txt',
      'tech-repo-scaffold/vertical-apps/template/backend/requirements.txt',
      'packages/automation/generators/migration/scaffold_populator.py',
    ]) {
      expect(source(path), path).toContain('stripe==16.1.0')
    }
    const billing = source('apps/union-eyes/backend/billing/tasks.py')
    expect(billing).toContain('stripe.StripeClient(stripe_key')
    expect(billing).toContain('client.v1.payment_intents.create(')
    expect(billing).not.toContain('stripe.api_key =')
    expect(billing).not.toContain('stripe.PaymentIntent.create(')
  })

  it('does not allow Zonga to bypass SDK, override API version or fake signatures', () => {
    const adapter = source('packages/zonga-payments/src/adapters/stripe.adapter.ts')
    expect(adapter).toContain('createStripeClientForKey')
    expect(adapter).toContain('stripe.webhooks.constructEvent(')
    expect(adapter).not.toContain('expectedSig.length > 0')
    expect(adapter).not.toContain('Stripe-Version')
    expect(adapter).not.toContain('apiVersion:')
    expect(manifest('packages/zonga-payments/package.json').dependencies?.['@nzila/payments-stripe']).toBe('workspace:*')
  })

})
