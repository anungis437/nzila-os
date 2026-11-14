/** Member-visible progress, never the union's working file or internal event notes. */
const MEMBER_FIELDS = [
  'id',
  'grievanceNumber',
  'organizationId',
  'type',
  'status',
  'priority',
  'title',
  'description',
  'grievantId',
  'createdBy',
  'grievantName',
  'grievantEmail',
  'employerName',
  'workplaceName',
  'incidentDate',
  'desiredOutcome',
  'filedDate',
  'createdAt',
  'updatedAt',
] as const

export function memberGrievanceView(row: Record<string, unknown>) {
  return Object.fromEntries(MEMBER_FIELDS.filter((key) => key in row).map((key) => [key, row[key]]))
}

export function memberGrievanceEvents<
  T extends {
    id: string
    eventType: string
    createdAt: unknown
    actorUserId: string
    notes: string | null
  },
>(events: T[]) {
  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    createdAt: event.createdAt,
    // Journal notes have no public-visibility classification. Authorship is not
    // continuing internal authority after a representative assignment is revoked.
    notes: null,
  }))
}
