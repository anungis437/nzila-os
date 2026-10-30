/**
 * Legacy event alias: the canonical handler already enforces active
 * organization membership, calendar privacy, locked mutation and atomic audit.
 * Re-export those exact handlers rather than adding a second, weaker wrapper.
 *
 * Delegation is visible to the route coverage scanner and inherits the
 * canonical route's authorization and audit classification.
 */
export const dynamic = 'force-dynamic';
export { GET, PATCH, DELETE } from '../../calendar/events/[id]/route';
