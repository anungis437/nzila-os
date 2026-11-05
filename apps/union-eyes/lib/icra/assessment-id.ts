const ASSESSMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A path value that is not a UUID names no assessment: it is answered as not found, never sent to the database to fail there. */
export function isAssessmentId(value: unknown): value is string {
  return typeof value === 'string' && ASSESSMENT_ID.test(value);
}
