import { and, eq } from 'drizzle-orm';
import { userNotificationPreferences } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';

export type InAppCategory = 'case' | 'message';

/**
 * Whether a recipient wants an in-app notice for this category. The recipient's preference row is
 * only readable under their own identity, so another user's action reads it on the system
 * connection, selecting nothing but the two flags. A missing row means defaults (deliver); a failed
 * lookup also delivers, since a missed notice is worse than an extra one.
 */
export async function inAppNoticeAllowed(userId: string, organizationId: string, category: InAppCategory): Promise<boolean> {
  try {
    const [prefs] = await withSystemContext(async (tx) =>
      tx
        .select({ inApp: userNotificationPreferences.inAppEnabled, claimUpdates: userNotificationPreferences.claimUpdates })
        .from(userNotificationPreferences)
        .where(and(eq(userNotificationPreferences.userId, userId), eq(userNotificationPreferences.organizationId, organizationId)))
        .limit(1),
    );
    if (!prefs) return true;
    if (prefs.inApp === false) return false;
    return !(category === 'case' && prefs.claimUpdates === false);
  } catch {
    return true;
  }
}
