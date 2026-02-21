/**
 * ESLint — No Direct Provider Import Rule
 *
 * Prevents direct imports of external service provider SDKs in app code.
 * All external service access must go through the corresponding Nzila
 * platform package (e.g., @nzila/payments-stripe, @nzila/qbo, @nzila/blob).
 *
 * This ensures:
 *   - All external calls are audited
 *   - Rate limiting is enforced
 *   - Secrets are managed via the platform layer
 *   - No provider lock-in leaks into app code
 *
 * Usage in your eslint.config.mjs:
 *
 *   import noDirectProvider from '@nzila/config/eslint-no-direct-provider'
 *   export default [
 *     ...otherConfigs,
 *     noDirectProvider,
 *   ]
 *
 * @module @nzila/config/eslint-no-direct-provider
 */

/** @type {import('eslint').Linter.FlatConfig} */
const noDirectProviderConfig = {
  name: 'nzila/no-direct-provider-import',
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // ── Payment Providers ──────────────────────────────────────────
          {
            group: ['stripe', 'stripe/*'],
            message:
              'Direct Stripe SDK import is prohibited. Use @nzila/payments-stripe for all payment operations. ' +
              'See packages/payments-stripe/README.md.',
          },
          // ── Accounting Providers ───────────────────────────────────────
          {
            group: ['node-quickbooks', 'node-quickbooks/*'],
            message:
              'Direct QuickBooks SDK import is prohibited. Use @nzila/qbo for all accounting operations.',
          },
          // ── Cloud Storage Providers ────────────────────────────────────
          {
            group: ['@azure/storage-blob', '@azure/storage-blob/*'],
            message:
              'Direct Azure Blob Storage SDK import is prohibited. Use @nzila/blob for all blob operations.',
          },
          {
            group: ['@aws-sdk/client-s3', '@aws-sdk/client-s3/*'],
            message:
              'Direct AWS S3 SDK import is prohibited. Use @nzila/blob for all blob operations.',
          },
          // ── Secret Management Providers ────────────────────────────────
          {
            group: ['@azure/keyvault-secrets', '@azure/keyvault-secrets/*'],
            message:
              'Direct Azure KeyVault import is prohibited in app code. Use @nzila/os-core/secrets.',
          },
          // ── Email/SMS Providers ────────────────────────────────────────
          {
            group: ['@sendgrid/mail', 'nodemailer', 'twilio'],
            message:
              'Direct email/SMS provider import is prohibited. Use the Nzila notification system.',
          },
        ],
      },
    ],
  },
}

export default noDirectProviderConfig
