/**
 * Legacy event item URL shares the canonical privacy and audit enforcement.
 * Never expose generic CRUD for another user's personal calendar.
 */
export { GET, PATCH, DELETE } from '@/app/api/calendar/events/[id]/route';
