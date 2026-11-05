/**
 * The instant an incident date is stored as. An incident date is typed as a calendar day ("2026-01-15") and claims.incident_date is a timestamp, so a day has to be given a time.
 * Midnight UTC of that day is the evening before in every Canadian time zone, so a screen that shows the stored date in the reader's zone would show the wrong day; noon UTC is
 * the same calendar day from UTC-11 to UTC+11. A value that already carries a time is an instant and is kept as sent.
 */
export function incidentInstant(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value)
}
