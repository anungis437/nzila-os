/**
 * packages/db/src/auth-storage-authority/duplicate-declarations.ts
 *
 * PR #752 round 14: schema-qualified duplicate-declaration census for
 * `user_management` physical tables. apps/union-eyes independently
 * re-declares several of packages/db/src/schema/auth.ts's tables as its
 * OWN Drizzle table objects (different export names, same physical
 * table), executed via apps/union-eyes/db/db.ts's own DATABASE_URL
 * connection — a THIRD path into this schema beyond @nzila/db/client and
 * @nzila/db/system-client. Round 13 flagged only the `authAuditLog`
 * export-name collision as a caveat; this module traces EVERY known
 * alternate declaration with real (non-test) importer evidence, keyed by
 * (schema, physical table name), not by TypeScript export name — an
 * export-name match (or mismatch) says nothing about whether two
 * declarations target the same physical table.
 *
 * Evidence method: for each physical table, grep every known Drizzle
 * declaration's export name across app/, actions/, lib/, services/,
 * scripts/ (excluding the declaring file itself, __tests__/, .next/
 * build output), then read each real hit to confirm intent (not a false
 * positive on an unrelated identically-named variable).
 */

export interface AuthAlternateDeclaration {
  exportName: string;
  file: string;
  /** Real (non-test, non-build-output) files that import this exact declaration. */
  productionImporters: string[];
  dbClient: string;
  reachable: boolean;
}

export interface AuthTableDuplicateDeclarationEntry {
  /** user_management.<table>, schema-qualified. */
  physicalTable: string;
  canonical: { exportName: string; file: string };
  alternates: AuthAlternateDeclaration[];
}

export const authTableDuplicateDeclarations: AuthTableDuplicateDeclarationEntry[] = [
  {
    physicalTable: 'user_management.users',
    canonical: { exportName: 'authUsers', file: 'packages/db/src/schema/auth.ts' },
    alternates: [
      {
        exportName: 'users',
        file: 'apps/union-eyes/db/schema/domains/member/user-management.ts',
        productionImporters: ['apps/union-eyes/lib/api-auth-guard.ts (reads users.isSystemAdmin for the CALLER\'s own userId)'],
        dbClient: 'apps/union-eyes/db/db.ts (DATABASE_URL)',
        reachable: true,
      },
      {
        exportName: 'users',
        file: 'apps/union-eyes/db/schema/user-management-schema.ts',
        productionImporters: [
          'apps/union-eyes/lib/services/grievance-notifications.ts',
          'apps/union-eyes/lib/services/messaging/campaign-service.ts',
          'apps/union-eyes/lib/deadline-engine/recipient-resolver.ts',
        ],
        dbClient: 'apps/union-eyes/db/db.ts (DATABASE_URL)',
        reachable: true,
      },
    ],
  },
  {
    physicalTable: 'user_management.organization_users',
    canonical: { exportName: 'authOrganizationUsers', file: 'packages/db/src/schema/auth.ts' },
    alternates: [
      {
        exportName: 'organizationUsers',
        file: 'apps/union-eyes/db/schema/domains/member/user-management.ts',
        productionImporters: [
          'apps/union-eyes/actions/admin-actions.ts',
          'apps/union-eyes/lib/middleware/api-security.ts',
        ],
        dbClient: 'apps/union-eyes/db/db.ts (DATABASE_URL)',
        reachable: true,
      },
      {
        exportName: 'organizationUsers',
        file: 'apps/union-eyes/db/schema/user-management-schema.ts',
        productionImporters: [],
        dbClient: 'apps/union-eyes/db/db.ts (DATABASE_URL)',
        reachable: false,
      },
    ],
  },
  {
    physicalTable: 'user_management.password_reset_tokens',
    canonical: { exportName: 'authPasswordResetTokens', file: 'packages/db/src/schema/auth.ts' },
    alternates: [
      {
        exportName: 'passwordResetTokens',
        file: 'apps/union-eyes/db/schema/domains/member/user-management.ts',
        productionImporters: [],
        dbClient: 'apps/union-eyes/db/db.ts (DATABASE_URL)',
        reachable: false,
      },
    ],
  },
  {
    physicalTable: 'user_management.auth_audit_log',
    canonical: { exportName: 'authAuditLog', file: 'packages/db/src/schema/auth.ts' },
    alternates: [
      {
        exportName: 'authAuditLog',
        file: 'apps/union-eyes/db/schema/domains/member/user-management.ts',
        productionImporters: [],
        dbClient: 'apps/union-eyes/db/db.ts (DATABASE_URL)',
        reachable: false,
      },
    ],
  },
  {
    physicalTable: 'user_management.oauth_providers',
    canonical: { exportName: 'authOauthProviders', file: 'packages/db/src/schema/auth.ts' },
    alternates: [
      {
        exportName: 'oauthProviders',
        file: 'apps/union-eyes/db/schema/domains/member/user-management.ts',
        productionImporters: ['apps/union-eyes/app/api/enterprise/integrations/route.ts (live crudRoutes CRUD endpoint)'],
        dbClient: 'apps/union-eyes/db/db.ts (DATABASE_URL)',
        reachable: true,
      },
    ],
  },
];

/**
 * NOT a duplicate: apps/union-eyes/db/schema/domains/member/user-
 * management.ts re-exports a `userSessions` symbol from
 * ../../user-management-schema, but that file's own doc comment records
 * a live-DB-verified fact (2026-09-01): that table physically lives in
 * `public.user_sessions` (created by migrations 0055/0058/0081 after
 * migration 0019 dropped the schema-qualified original) — a DIFFERENT
 * physical table from packages/db/src/schema/auth.ts's
 * `user_management.user_sessions` (authUserSessions). Recorded here so a
 * future scan doesn't misclassify the name collision as a duplicate.
 */
export const KNOWN_NON_DUPLICATE_NAME_COLLISION = {
  name: 'userSessions / user_sessions',
  unionEyesTable: 'public.user_sessions',
  sharedTable: 'user_management.user_sessions',
} as const;
