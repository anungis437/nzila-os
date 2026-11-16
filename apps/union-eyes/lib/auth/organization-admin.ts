import type { RLSTx } from '@/lib/db/with-rls-context'
import { currentStateContextEnabled } from './canonical-bootstrap'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'

/** Business administration uses the current transaction's live membership, never a supplied role or an auth-gateway credential. */
export async function isActiveOrganizationAdministrator(tx: RLSTx, actor: { userId: string; organizationId: string }): Promise<boolean> {
  const exec = drizzleExecutor(tx)
  const { rows } = currentStateContextEnabled()
    ? await exec.query<{ allowed: boolean }>(`SELECT user_management.auth_business_org_authorized($1::uuid,ARRAY['admin']::text[])
        AND current_setting('app.current_user_id',true)=$2 AS allowed`, [actor.organizationId, actor.userId])
    : await exec.query<{ allowed: boolean }>(`SELECT EXISTS(SELECT FROM user_management.users u
        JOIN user_management.organization_users m ON m.user_id=u.user_id
        WHERE u.user_id=$1 AND current_setting('app.current_user_id',true)=$1
          AND u.is_active AND u.lifecycle_state='active'
          AND m.organization_id=$2::uuid AND m.is_active AND m.role='admin') AS allowed`, [actor.userId, actor.organizationId])
  return rows[0]?.allowed === true
}
