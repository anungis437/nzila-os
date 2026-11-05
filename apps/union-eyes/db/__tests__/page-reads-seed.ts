/**
 * Seeding helpers shared by the native page-read tests (a disposable, fully bootstrapped database, an ADMIN connection).
 */
import type pg from 'pg'

export interface SeededOrganization {
  id: string
  name?: string
  type?: 'local' | 'union' | 'federation' | 'congress'
  parentId?: string | null
  /** Ancestors, root first, not the organization itself. */
  path?: string[]
  level?: number
  province?: string | null
  slug?: string
  memberCount?: number
  status?: string
}

export async function insertOrganization(admin: pg.Client, tag: string, org: SeededOrganization): Promise<void> {
  await admin.query(
    `INSERT INTO organizations (id, name, slug, organization_type, parent_id, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, province_territory, created_at, updated_at, remittance_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', false, $8, $8, '{}', '{}', $9, $10, now(), now(), 1)`,
    [
      org.id,
      org.name ?? `Org ${org.id.slice(0, 8)} ${tag}`,
      org.slug ?? `pr-${org.id.slice(0, 8)}-${tag}`,
      org.type ?? 'local',
      org.parentId ?? null,
      org.path ?? [],
      org.level ?? 0,
      org.memberCount ?? 0,
      org.status ?? 'active',
      org.province ?? null,
    ],
  )
}

export async function insertMember(
  admin: pg.Client,
  organizationId: string,
  member: { userId: string; role?: string; name?: string; email?: string; status?: string },
): Promise<string> {
  const { rows } = await admin.query(
    `INSERT INTO organization_members (user_id, role, organization_id, name, email, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text AS id`,
    [member.userId, member.role ?? 'member', organizationId, member.name ?? member.userId, member.email ?? `${member.userId}@example.test`, member.status ?? 'active'],
  )
  return rows[0].id as string
}
