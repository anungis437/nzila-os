const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
fs.writeFileSync('lib/services/committee-read-access.ts', `import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { committeeMemberships } from '@/db/schema'
import { ApiError } from '@/lib/api/errors'
import { isBelowStaff } from '@/lib/api/crud-low-role-guard'
import { requireCommitteeScope } from '@/lib/services/committee-workspace-service'

/**
 * A committee's meetings, attendance, action items and documents are its working record. The committee must be the
 * caller's organization's, and the reader must be staff or an active member of that committee; any other member
 * gets the same answer as for a committee that does not exist.
 */
export async function requireCommitteeReader(
  organizationId: string,
  committeeId: string,
  userId: string | null | undefined,
  children: { meetingId?: string; actionItemId?: string; documentId?: string } = {},
): Promise<void> {
  await requireCommitteeScope(organizationId, committeeId, children)
  if (!userId) throw ApiError.notFound('Committee')
  if (!(await isBelowStaff(userId, organizationId))) return
  const [membership] = await db
    .select({ id: committeeMemberships.id })
    .from(committeeMemberships)
    .where(and(
      eq(committeeMemberships.committeeId, committeeId),
      eq(committeeMemberships.memberId, userId),
      eq(committeeMemberships.status, 'active'),
    ))
    .limit(1)
  if (!membership) throw ApiError.notFound('Committee')
}
`)
const base = 'app/api/committees/[id]/'
const patch = (f, userVar, scopeCall, newCall, params) => edit(base + f, [
  [scopeCall, newCall],
])
edit(base + 'action-items/route.ts', [
  [`  async ({ organizationId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeScope(organizationId, committeeId);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const assignedTo`, `  async ({ organizationId, userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeReader(organizationId, committeeId, userId);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const assignedTo`],
])
edit(base + 'documents/route.ts', [
  [`  async ({ organizationId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeScope(organizationId, committeeId);
    const searchParams = request.nextUrl.searchParams;
    const category`, `  async ({ organizationId, userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeReader(organizationId, committeeId, userId);
    const searchParams = request.nextUrl.searchParams;
    const category`],
])
edit(base + 'meetings/route.ts', [
  [`  async ({ organizationId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeScope(organizationId, committeeId);
    const searchParams = request.nextUrl.searchParams;
    const status`, `  async ({ organizationId, userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeReader(organizationId, committeeId, userId);
    const searchParams = request.nextUrl.searchParams;
    const status`],
])
edit(base + 'meetings/[meetingId]/route.ts', [
  [`  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId });
    const meeting = await getMeeting(meetingId);`, `  async ({ organizationId, userId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeReader(organizationId, committeeId, userId, { meetingId });
    const meeting = await getMeeting(meetingId);`],
])
edit(base + 'meetings/[meetingId]/attendance/route.ts', [
  [`  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId });
    return getMeetingAttendees(meetingId);`, `  async ({ organizationId, userId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeReader(organizationId, committeeId, userId, { meetingId });
    return getMeetingAttendees(meetingId);`],
])
for (const f of ['action-items/route.ts', 'documents/route.ts', 'meetings/route.ts', 'meetings/[meetingId]/route.ts', 'meetings/[meetingId]/attendance/route.ts']) {
  let s = fs.readFileSync(base + f, 'utf8').replace(/\r\n/g, '\n')
  s = s.replace(/(import [^\n]*\n)/, `$1import { requireCommitteeReader } from "@/lib/services/committee-read-access";\n`)
  fs.writeFileSync(base + f, s)
}
console.log('ok')
