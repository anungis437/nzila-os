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
>(events: T[], userId: string) {
  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    createdAt: event.createdAt,
    notes: event.actorUserId === userId ? event.notes : null,
  }))
}
