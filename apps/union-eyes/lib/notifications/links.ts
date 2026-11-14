/**
 * Where a notification sends the person who opens it.
 *
 * A notification's `actionUrl` is stored as an in-app path WITHOUT a locale (`/dashboard/workbench`); the screen that shows it adds the reader's own
 * locale (inbox-links.ts), so a French reader lands on the French page. Every writer builds its path here, and links.test.ts holds each builder to two
 * facts: the path is a page the app serves, and the person it is written for may open it. The second is not a formality: the dashboard bounces a role
 * from every page its experience does not include (lib/dashboard/role-experience.ts), and a link that lands on someone else's landing page is a link that
 * pretends.
 *
 * Signing and alerts pages do not exist, so notifications about them carry no link. Individual grievance detail links are now reachable under the
 * detail API's case authority; the existing grievance lifecycle writers currently omit actionUrl.
 */

export class NotificationLinkError extends Error {
  constructor(what: string) {
    super(`Notification link: ${what}`);
    this.name = 'NotificationLinkError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidSegment(what: string, value: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new NotificationLinkError(`${what} is not a uuid`);
  return value.toLowerCase();
}

/** A same-site path: one leading slash, no scheme, no protocol-relative address, no whitespace or backslash. The create route bounds it at 500 characters. */
const IN_APP_PATH = /^\/(?!\/)[^\s\\]*$/;
const MAX_PATH = 500;

export const isInAppPath = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_PATH && IN_APP_PATH.test(value);

/** A path a person or a workflow configured, when it is a same-site path; undefined when it is anything else (a link is then left out, never guessed). */
export function sameSiteActionPath(value: unknown): string | undefined {
  return isInAppPath(value) ? value : undefined;
}

/** The member's own case ("My Representation"), for the member the case belongs to. Staff roles are not admitted to it; they work cases from the workbench. */
export const memberCaseUrl = (claimId: string): string => `/dashboard/claims/${uuidSegment('claimId', claimId)}`;

/** The steward's workbench, where the cases assigned to them are worked. Cases have no page of their own for staff. */
export const workbenchUrl = (): string => '/dashboard/workbench';

/** A conversation in the messages screen of the person it is for: the member's own, or the staff member's queue. */
export function messageThreadUrl(threadId: string, audience: 'member' | 'staff'): string {
  const id = uuidSegment('threadId', threadId);
  return audience === 'member' ? `/dashboard/messages?thread=${id}` : `/dashboard/messages/staff?thread=${id}`;
}

/** The builders, by name: the guard test accepts an `actionUrl` written by one of these. */
export const NOTIFICATION_LINK_BUILDERS = ['memberCaseUrl', 'workbenchUrl', 'messageThreadUrl', 'sameSiteActionPath'] as const;
