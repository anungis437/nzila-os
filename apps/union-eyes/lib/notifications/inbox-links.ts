/**
 * What a screen that shows an inbox needs from a stored notification and from the person's role, for browser code.
 *
 * The writers' side is links.ts: an `actionUrl` is stored as an in-app path without a locale. This is the reader's side.
 */
import { locales } from '@/i18n/config';
import { canAccessDashboardPath, getDashboardExperience } from '@/lib/dashboard/role-experience';
import { isInAppPath } from './links';

/**
 * A stored `actionUrl` as a link for the reader: their locale in front of an in-app path. Null when the stored value is not an in-app path (rows come from
 * several writers, and a value that is anything else is never put in a link). A path that already begins with a locale is kept as it is.
 */
export function localizedActionHref(locale: string, actionUrl: string): string | null {
  if (!isInAppPath(actionUrl)) return null;
  const first = actionUrl.split('/')[1]?.split(/[?#]/)[0] ?? '';
  return (locales as readonly string[]).includes(first) ? actionUrl : `/${locale}${actionUrl}`;
}

/**
 * The page that shows a person their inbox, or null when none of their pages does. The dashboard admits each role to some pages only, so the answer is
 * read from that policy and not assumed: staff have the notifications page; a member's unread notices are on their Home; no page of an executive,
 * governance or admin role shows the inbox, and the bell is then not drawn for them rather than linked to a page they would be sent away from.
 */
export function inboxPathFor(role: string | null | undefined): string | null {
  const experience = getDashboardExperience(role);
  if (canAccessDashboardPath('/dashboard/notifications', experience, false)) return '/dashboard/notifications';
  return experience === 'member' ? '/dashboard' : null;
}
