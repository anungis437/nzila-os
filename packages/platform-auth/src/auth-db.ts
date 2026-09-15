import { db } from '@nzila/db/client'
import { systemDb } from '@nzila/db/system-client'

/**
 * Internal auth-bootstrap executor.
 *
 * Password login and session-cookie validation must resolve identity before
 * app.current_user_id exists, so they cannot use the ordinary tenant runtime
 * connection once auth tables are protected by self-only RLS. Production-like
 * deployments should provide SYSTEM_DATABASE_URL with narrowly granted auth
 * privileges. Local/test environments without that variable fall back to the
 * ordinary client.
 */
export const authDb = process.env.SYSTEM_DATABASE_URL ? systemDb : db

