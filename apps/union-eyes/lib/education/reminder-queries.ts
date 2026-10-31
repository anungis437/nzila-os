import { sql } from 'drizzle-orm'

// The reminder jobs read only columns the training schema declares: a session starts on start_date, a venue and an instructor
// are named on the session, a certification carries certification_number and its own course, and a member is the
// organization_members row of the same organization whose user_id is the registration's member id.
//
// A member who turned e-mail off, or training reminders off, in their communication preferences is not written to: an absent preference
// row is the default (on), an explicit false is an opt-out.
export const sessionReminderQuery = sql`
  SELECT
    om.email,
    om.user_id,
    cr.organization_id,
    cr.id AS reminder_source_id,
    COUNT(*) OVER() AS total_due,
    om.name AS member_name,
    c.course_name,
    cs.start_date AS session_date,
    cs.session_times,
    COALESCE(cs.venue_name, CASE WHEN cs.virtual_meeting_url IS NOT NULL THEN 'Online' END) AS location,
    c.duration_hours,
    cs.lead_instructor_name,
    (cs.start_date - CURRENT_DATE)::int AS days_until
  FROM course_registrations cr
  JOIN organization_members om ON om.user_id = cr.member_id AND om.organization_id = cr.organization_id
  LEFT JOIN communication_preferences cp ON cp.user_id = om.user_id AND cp.organization_id = om.organization_id
  JOIN training_courses c ON c.id = cr.course_id AND c.organization_id = cr.organization_id
  JOIN course_sessions cs ON cs.id = cr.session_id AND cs.organization_id = cr.organization_id
  WHERE cr.registration_status = 'registered'
    AND cs.session_status = 'scheduled'
    AND om.status = 'active'
    AND COALESCE(cp.email_enabled, true)
    AND COALESCE(cp.training_reminders, true)
    AND cs.start_date IN (CURRENT_DATE + 7, CURRENT_DATE + 3, CURRENT_DATE + 1)
    AND om.email IS NOT NULL
    AND om.email <> ''
    -- The durable marker excludes completed or reconciliation-held deliveries. This lets
    -- a later capped run reach the remaining recipients instead of repeating page one.
    AND NOT EXISTS (
      SELECT 1 FROM in_app_notifications notice
      WHERE notice.organization_id = cr.organization_id
        AND notice.user_id = om.user_id
        AND notice.data->>'dedupeKey' = 'education:session:' || cr.id::text || ':' || (cs.start_date - CURRENT_DATE)::text
    )
  ORDER BY cs.start_date, om.email, cr.id
  LIMIT 301
`

export const expiryWarningQuery = sql`
  SELECT
    om.email,
    om.user_id,
    mc.organization_id,
    mc.id AS reminder_source_id,
    COUNT(*) OVER() AS total_due,
    om.name AS member_name,
    mc.certification_name,
    mc.certification_number,
    mc.expiry_date,
    (mc.expiry_date - CURRENT_DATE)::int AS days_until_expiry
  FROM member_certifications mc
  JOIN organization_members om ON om.user_id = mc.member_id AND om.organization_id = mc.organization_id
  LEFT JOIN communication_preferences cp ON cp.user_id = om.user_id AND cp.organization_id = om.organization_id
  WHERE mc.certification_status = 'active'
    AND mc.revoked IS NOT TRUE
    AND om.status = 'active'
    AND COALESCE(cp.email_enabled, true)
    AND COALESCE(cp.training_reminders, true)
    AND mc.expiry_date IN (CURRENT_DATE + 90, CURRENT_DATE + 30)
    AND om.email IS NOT NULL
    AND om.email <> ''
    AND NOT EXISTS (
      SELECT 1 FROM in_app_notifications notice
      WHERE notice.organization_id = mc.organization_id
        AND notice.user_id = om.user_id
        AND notice.data->>'dedupeKey' = 'education:certification:' || mc.id::text || ':' || (mc.expiry_date - CURRENT_DATE)::text
    )
  ORDER BY mc.expiry_date, om.email, mc.id
  LIMIT 301
`

/** drizzle returns the rows directly or under .rows, depending on the driver. */
export function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  const rows = (result as { rows?: unknown } | null)?.rows
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []
}

const longDate = (value: unknown, withWeekday: boolean) =>
  new Date(value as string).toLocaleDateString('en-US', {
    ...(withWeekday ? { weekday: 'long' as const } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

export function toSessionReminder(row: Record<string, unknown>) {
  return {
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    sourceId: String(row.reminder_source_id),
    toEmail: String(row.email),
    memberName: String(row.member_name),
    courseName: String(row.course_name),
    sessionDate: longDate(row.session_date, true),
    sessionTime: 'TBD',
    daysUntilSession: Number(row.days_until),
    location: row.location ? String(row.location) : undefined,
    instructorName: row.lead_instructor_name ? String(row.lead_instructor_name) : undefined,
    sessionDuration: row.duration_hours ? Number(row.duration_hours) : undefined,
  }
}

export function toExpiryWarning(row: Record<string, unknown>) {
  return {
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    sourceId: String(row.reminder_source_id),
    toEmail: String(row.email),
    memberName: String(row.member_name),
    certificationName: String(row.certification_name),
    certificateNumber: row.certification_number ? String(row.certification_number) : 'not recorded',
    expiryDate: longDate(row.expiry_date, false),
    daysUntilExpiry: Number(row.days_until_expiry),
  }
}
