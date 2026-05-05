/**
 * TrustCore — App Configuration
 *
 * Central config for the TrustCore application.
 * Values are read from environment variables at runtime.
 */

export const trustcoreConfig = {
  appName: 'TrustCore',
  appVersion: process.env.npm_package_version ?? '0.1.0',

  auth: {
    sessionCookieName: 'selected_org_id',
    orgCookieFallback: 'selected_organization_id',
  },

  compliance: {
    /** Law 25 (Quebec) is the default compliance framework for v1. */
    defaultFramework: 'law-25' as const,
    passingScore: 70,
  },
} as const
