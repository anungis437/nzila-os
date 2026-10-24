import type { PGlite } from '@electric-sql/pglite'

/** The shape platform 0014 creates, without its guard triggers, for tests that only need the read predicate. */
export const TRIAGE_DESIGNATIONS_DDL = `
  CREATE TABLE IF NOT EXISTS triage_designations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    scope text NOT NULL CHECK (scope IN ('messages', 'cases')),
    user_id text NOT NULL,
    granted_by text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    revoked_by text
  );
`

export async function designate(
  pg: PGlite,
  input: { organizationId: string; scope: 'messages' | 'cases'; userId: string; expiresInDays?: number; revoked?: boolean },
): Promise<void> {
  const days = input.expiresInDays ?? 30
  await pg.query(
    `INSERT INTO triage_designations(organization_id, scope, user_id, granted_by, granted_at, expires_at, revoked_at, revoked_by)
     VALUES($1, $2, $3, 'admin-1', now() - interval '100 days', now() + ($4 || ' days')::interval, $5, $6)`,
    [
      input.organizationId,
      input.scope,
      input.userId,
      String(days),
      input.revoked ? new Date().toISOString() : null,
      input.revoked ? 'admin-1' : null,
    ],
  )
}
