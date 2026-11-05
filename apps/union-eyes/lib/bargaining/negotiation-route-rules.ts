/**
 * Rules shared by every path that serves the negotiations collection.
 *
 * Negotiation records hold strike-vote results, mandates and cost ceilings, so they are read at steward level, and the fields
 * that must come from a source record (the vote, the mandate, the costing, the status, the confidentiality label and the
 * links to other agreements) are not writable through the generic interface: a typed strike-vote result or cost ceiling
 * would otherwise be stored as the record and shown to every member. Both /api/bargaining/negotiations and /api/negotiations
 * take their rules from here, so a restriction added once applies to both.
 */
export const NEGOTIATION_WRITABLE_FIELDS = [
  'title', 'description', 'unionName', 'unionLocal', 'employerName', 'bargainingUnitSize',
  'noticeGivenDate', 'firstSessionDate', 'targetCompletionDate', 'keyIssues', 'tags', 'progressSummary',
]

export const NEGOTIATION_ROUTE_RULES = {
  readRole: 'steward',
  writeRole: 'steward',
  writableFields: NEGOTIATION_WRITABLE_FIELDS,
} as const
