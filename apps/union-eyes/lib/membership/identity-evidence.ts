/**
 * Read-only evidence of membership identity defects, for an operator deciding whether a governed reconciliation is needed.
 *
 * Before the member import refused unresolved identities, an unknown or failed directory lookup inserted the membership under a random user id
 * that names no principal. This collects, without changing anything:
 *   - DUPLICATE_EMAIL: within one organization, live memberships that share an email (case-insensitive) under more than one user id;
 *   - UNRESOLVED_PRINCIPAL: live memberships whose user id has no canonical principal (user_management.users), the signature of a minted id.
 * It reports membership ids and counts only, never emails or names. Everything runs in a READ ONLY transaction, so even a mistaken statement
 * cannot write. Reconciling what it finds (merging, re-pointing or retiring memberships) is a separate, authorized operation; this does none of it.
 */

export interface ReadOnlyQueryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface MembershipIdentityFinding {
  kind: 'DUPLICATE_EMAIL' | 'UNRESOLVED_PRINCIPAL';
  organizationId: string;
  membershipIds: string[];
}

export interface MembershipIdentityEvidence {
  collectedAt: string;
  scope: { organizationIds: string[] | 'ALL' };
  counts: { duplicateEmailGroups: number; duplicateEmailMemberships: number; unresolvedPrincipalMemberships: number };
  findings: MembershipIdentityFinding[];
}

export async function collectMembershipIdentityEvidence(
  client: ReadOnlyQueryable,
  options: { organizationIds?: string[] } = {},
): Promise<MembershipIdentityEvidence> {
  const scope = options.organizationIds?.length ? options.organizationIds : null;
  await client.query('BEGIN TRANSACTION READ ONLY');
  try {
    const duplicates = await client.query(
      `SELECT organization_id::text AS organization_id, array_agg(id::text ORDER BY id) AS membership_ids
         FROM organization_members
        WHERE deleted_at IS NULL AND ($1::uuid[] IS NULL OR organization_id = ANY($1::uuid[]))
        GROUP BY organization_id, lower(btrim(email))
       HAVING count(DISTINCT user_id) > 1
        ORDER BY 1, 2`,
      [scope],
    );
    const unresolved = await client.query(
      `SELECT m.organization_id::text AS organization_id, array_agg(m.id::text ORDER BY m.id) AS membership_ids
         FROM organization_members m
        WHERE m.deleted_at IS NULL AND ($1::uuid[] IS NULL OR m.organization_id = ANY($1::uuid[]))
          AND NOT EXISTS (SELECT 1 FROM user_management.users u WHERE u.user_id = m.user_id)
        GROUP BY m.organization_id
        ORDER BY 1`,
      [scope],
    );
    const findings: MembershipIdentityFinding[] = [
      ...duplicates.rows.map((r) => ({ kind: 'DUPLICATE_EMAIL' as const, organizationId: String(r.organization_id), membershipIds: r.membership_ids as string[] })),
      ...unresolved.rows.map((r) => ({ kind: 'UNRESOLVED_PRINCIPAL' as const, organizationId: String(r.organization_id), membershipIds: r.membership_ids as string[] })),
    ];
    const dup = findings.filter((f) => f.kind === 'DUPLICATE_EMAIL');
    return {
      collectedAt: new Date().toISOString(),
      scope: { organizationIds: scope ?? 'ALL' },
      counts: {
        duplicateEmailGroups: dup.length,
        duplicateEmailMemberships: dup.reduce((n, f) => n + f.membershipIds.length, 0),
        unresolvedPrincipalMemberships: findings.filter((f) => f.kind === 'UNRESOLVED_PRINCIPAL').reduce((n, f) => n + f.membershipIds.length, 0),
      },
      findings,
    };
  } finally {
    await client.query('ROLLBACK');
  }
}
